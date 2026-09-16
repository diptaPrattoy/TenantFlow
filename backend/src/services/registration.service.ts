import type Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { ApiError } from "../errors/api-error.js";
import { env } from "../config/env.js";
import { hashPassword } from "../utils/password.js";
import type { StartRegistrationInput } from "../schemas/registration.schema.js";

const checkoutResult = (
  registrationId: string,
  session: Stripe.Checkout.Session,
) => {
  if (!session.url) {
    throw new ApiError(502, "Stripe did not return a checkout URL.");
  }

  return {
    registrationId,
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    expiresAt: new Date(session.expires_at * 1000),
  };
};

const createCheckoutSession = async (
  registrationId: string,
  adminEmail: string,
  planId: string,
  stripePriceId: string,
) => {
  const baseFrontendUrl = env.frontendUrl.replace(/\/$/, "");
  const encodedRegistrationId = encodeURIComponent(registrationId);

  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: adminEmail,
    client_reference_id: registrationId,
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      registrationIntentId: registrationId,
      planId,
    },
    subscription_data: {
      metadata: {
        registrationIntentId: registrationId,
        planId,
      },
    },
    success_url: `${baseFrontendUrl}/?checkout=success&registration_id=${encodedRegistrationId}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseFrontendUrl}/?checkout=cancelled&registration_id=${encodedRegistrationId}`,
  });
};

const saveCheckoutSession = async (
  registrationId: string,
  session: Stripe.Checkout.Session,
) => {
  await prisma.registrationIntent.update({
    where: { id: registrationId },
    data: {
      status: "CHECKOUT_CREATED",
      stripeCheckoutSessionId: session.id,
      expiresAt: new Date(session.expires_at * 1000),
    },
  });
};

const closePreviousCheckoutSessions = async (adminEmail: string) => {
  const activeIntents = await prisma.registrationIntent.findMany({
    where: {
      adminEmail,
      status: "CHECKOUT_CREATED",
      stripeCheckoutSessionId: { not: null },
    },
    select: {
      stripeCheckoutSessionId: true,
    },
  });

  for (const intent of activeIntents) {
    if (!intent.stripeCheckoutSessionId) {
      continue;
    }

    const session = await stripe.checkout.sessions.retrieve(
      intent.stripeCheckoutSessionId,
    );

    if (session.status === "complete") {
      throw new ApiError(
        409,
        "A payment for this email is already waiting for confirmation.",
      );
    }

    if (session.status === "open") {
      await stripe.checkout.sessions.expire(session.id);
    }
  }
};

export const startRegistration = async (input: StartRegistrationInput) => {
  const plan = await prisma.plan.findFirst({
    where: {
      id: input.planId,
      isActive: true,
    },
  });

  if (!plan) {
    throw new ApiError(404, "Selected plan is not available.");
  }

  if (!plan.stripePriceId) {
    throw new ApiError(
      409,
      "This plan is not ready for checkout. Sync the plans with Stripe first.",
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: input.adminEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new ApiError(409, "An account already exists with this email.");
  }

  await closePreviousCheckoutSessions(input.adminEmail);

  const passwordHash = await hashPassword(input.password);

  const intent = await prisma.$transaction(async (tx) => {
    await tx.registrationIntent.updateMany({
      where: {
        adminEmail: input.adminEmail,
        status: { in: ["PENDING", "CHECKOUT_CREATED"] },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return tx.registrationIntent.create({
      data: {
        organizationName: input.organizationName,
        adminName: input.adminName,
        adminEmail: input.adminEmail,
        adminPasswordHash: passwordHash,
        planId: plan.id,
        status: "PENDING",
      },
    });
  });

  const session = await createCheckoutSession(
    intent.id,
    intent.adminEmail,
    plan.id,
    plan.stripePriceId,
  );

  await saveCheckoutSession(intent.id, session);

  return {
    ...checkoutResult(intent.id, session),
    plan: {
      id: plan.id,
      name: plan.name,
      priceAmount: plan.priceAmount,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
    },
  };
};

export const retryRegistrationCheckout = async (registrationId: string) => {
  const intent = await prisma.registrationIntent.findUnique({
    where: { id: registrationId },
    include: { plan: true },
  });

  if (!intent) {
    throw new ApiError(404, "Registration not found.");
  }

  if (intent.status === "COMPLETED") {
    throw new ApiError(409, "This registration has already been completed.");
  }

  if (!intent.plan.isActive) {
    throw new ApiError(409, "The selected plan is no longer available.");
  }

  if (!intent.plan.stripePriceId) {
    throw new ApiError(
      409,
      "This plan is not ready for checkout. Sync the plans with Stripe first.",
    );
  }

  if (
    intent.status === "CHECKOUT_CREATED" &&
    intent.stripeCheckoutSessionId
  ) {
    const existingSession = await stripe.checkout.sessions.retrieve(
      intent.stripeCheckoutSessionId,
    );

    if (existingSession.status === "open" && existingSession.url) {
      return checkoutResult(intent.id, existingSession);
    }

    if (existingSession.status === "complete") {
      throw new ApiError(
        409,
        "Payment was submitted and is waiting for confirmation.",
      );
    }
  }

  const session = await createCheckoutSession(
    intent.id,
    intent.adminEmail,
    intent.plan.id,
    intent.plan.stripePriceId,
  );

  await saveCheckoutSession(intent.id, session);

  return checkoutResult(intent.id, session);
};

export const getRegistrationStatus = async (registrationId: string) => {
  const intent = await prisma.registrationIntent.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      createdAt: true,
      organizationId: true,
      plan: {
        select: {
          id: true,
          name: true,
          priceAmount: true,
          currency: true,
          billingInterval: true,
        },
      },
    },
  });

  if (!intent) {
    throw new ApiError(404, "Registration not found.");
  }

  return {
    id: intent.id,
    status: intent.status,
    expiresAt: intent.expiresAt,
    createdAt: intent.createdAt,
    organizationCreated: Boolean(intent.organizationId),
    plan: intent.plan,
  };
};
