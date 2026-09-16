import type Stripe from "stripe";

import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { ApiError } from "../errors/api-error.js";

const webhookErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message.slice(0, 1000);
  }

  return "Webhook processing failed.";
};

const claimWebhookEvent = async (event: Stripe.Event) => {
  try {
    await prisma.webhookEvent.create({
      data: {
        stripeEventId: event.id,
        eventType: event.type,
        status: "RECEIVED",
        processingAttempts: 1,
      },
    });

    return "claimed" as const;
  } catch (error) {
    const existing = await prisma.webhookEvent.findUnique({
      where: { stripeEventId: event.id },
    });

    if (!existing) {
      throw error;
    }

    if (existing.status === "PROCESSED") {
      return "processed" as const;
    }

    if (existing.status === "FAILED") {
      const retry = await prisma.webhookEvent.updateMany({
        where: {
          id: existing.id,
          status: "FAILED",
        },
        data: {
          status: "RECEIVED",
          processingAttempts: { increment: 1 },
          lastError: null,
        },
      });

      if (retry.count === 1) {
        return "claimed" as const;
      }
    }

    const staleBefore = new Date(Date.now() - 2 * 60 * 1000);

    if (existing.status === "RECEIVED" && existing.updatedAt < staleBefore) {
      const recovered = await prisma.webhookEvent.updateMany({
        where: {
          id: existing.id,
          status: "RECEIVED",
          updatedAt: existing.updatedAt,
        },
        data: {
          processingAttempts: { increment: 1 },
          lastError: null,
        },
      });

      if (recovered.count === 1) {
        return "claimed" as const;
      }
    }

    throw new ApiError(503, "Webhook event is already being processed.");
  }
};

const markWebhookProcessed = async (eventId: string) => {
  await prisma.webhookEvent.update({
    where: { stripeEventId: eventId },
    data: {
      status: "PROCESSED",
      processedAt: new Date(),
      lastError: null,
    },
  });
};

const markWebhookFailed = async (eventId: string, error: unknown) => {
  await prisma.webhookEvent.update({
    where: { stripeEventId: eventId },
    data: {
      status: "FAILED",
      lastError: webhookErrorMessage(error),
    },
  });
};

const expandableId = (
  value: string | { id: string } | null | undefined,
): string | null => {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : value.id;
};

const getCheckoutDetails = async (sessionId: string) => {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "invoice"],
  });

  const subscriptionId = expandableId(session.subscription);
  const customerId = expandableId(session.customer);
  const invoiceId = expandableId(session.invoice);

  if (!subscriptionId || !customerId) {
    throw new ApiError(409, "Stripe subscription details are incomplete.");
  }

  const subscription =
    typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(subscriptionId)
      : session.subscription;

  if (!subscription || typeof subscription === "string") {
    throw new ApiError(409, "Stripe subscription could not be verified.");
  }

  const subscriptionItem = subscription.items.data[0];

  if (!subscriptionItem) {
    throw new ApiError(409, "Stripe subscription has no billing item.");
  }

  const invoice = invoiceId
    ? typeof session.invoice === "string"
      ? await stripe.invoices.retrieve(invoiceId)
      : session.invoice
    : null;

  return {
    session,
    subscription,
    subscriptionItem,
    customerId,
    invoice,
    invoiceId,
  };
};

const activateRegistration = async (sessionId: string) => {
  const details = await getCheckoutDetails(sessionId);
  const { session, subscription, subscriptionItem, customerId, invoice, invoiceId } =
    details;

  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    return;
  }

  const registrationId =
    session.metadata?.registrationIntentId ?? session.client_reference_id;

  if (!registrationId) {
    throw new ApiError(400, "Registration reference is missing from checkout.");
  }

  const intent = await prisma.registrationIntent.findUnique({
    where: { id: registrationId },
    include: { plan: true },
  });

  if (!intent) {
    throw new ApiError(404, "Registration for this payment was not found.");
  }

  if (intent.status === "COMPLETED") {
    return;
  }

  if (intent.stripeCheckoutSessionId !== session.id) {
    throw new ApiError(409, "Checkout session does not match this registration.");
  }

  if (session.metadata?.planId && session.metadata.planId !== intent.planId) {
    throw new ApiError(409, "Checkout plan does not match this registration.");
  }

  if (session.amount_total !== intent.plan.priceAmount) {
    throw new ApiError(409, "Checkout amount does not match the selected plan.");
  }

  if (session.currency?.toUpperCase() !== intent.plan.currency.toUpperCase()) {
    throw new ApiError(409, "Checkout currency does not match the selected plan.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: intent.adminEmail },
    select: { id: true },
  });

  if (existingUser) {
    throw new ApiError(409, "An account already exists with this email.");
  }

  const paidAt = new Date();
  const currentPeriodStart = new Date(
    subscriptionItem.current_period_start * 1000,
  );
  const currentPeriodEnd = new Date(subscriptionItem.current_period_end * 1000);

  await prisma.$transaction(async (tx) => {
    const currentIntent = await tx.registrationIntent.findUnique({
      where: { id: intent.id },
      select: { status: true },
    });

    if (!currentIntent) {
      throw new ApiError(404, "Registration was not found.");
    }

    if (currentIntent.status === "COMPLETED") {
      return;
    }

    const organization = await tx.organization.create({
      data: {
        name: intent.organizationName,
        contactEmail: intent.adminEmail,
        billingEmail: intent.adminEmail,
        status: "ACTIVE",
        stripeCustomerId: customerId,
      },
    });

    await tx.user.create({
      data: {
        organizationId: organization.id,
        name: intent.adminName,
        email: intent.adminEmail,
        passwordHash: intent.adminPasswordHash,
        role: "ORG_ADMIN",
        status: "ACTIVE",
      },
    });

    const localSubscription = await tx.subscription.create({
      data: {
        organizationId: organization.id,
        planId: intent.planId,
        status: "ACTIVE",
        stripeSubscriptionId: subscription.id,
        stripePriceId: intent.plan.stripePriceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    await tx.subscriptionEvent.create({
      data: {
        organizationId: organization.id,
        subscriptionId: localSubscription.id,
        eventType: "CREATED",
        newPlanId: intent.planId,
        metadata: {
          stripeCheckoutSessionId: session.id,
          stripeSubscriptionId: subscription.id,
        },
      },
    });

    const payment = await tx.payment.create({
      data: {
        organizationId: organization.id,
        subscriptionId: localSubscription.id,
        amount: session.amount_total ?? intent.plan.priceAmount,
        currency: session.currency?.toUpperCase() ?? intent.plan.currency,
        status: "SUCCESS",
        stripeCheckoutSessionId: session.id,
        stripeInvoiceId: invoiceId,
        invoiceUrl: invoice?.hosted_invoice_url ?? null,
        invoicePdfUrl: invoice?.invoice_pdf ?? null,
        paidAt,
      },
    });

    await tx.transaction.create({
      data: {
        organizationId: organization.id,
        paymentId: payment.id,
        registrationIntentId: intent.id,
        type: "SUBSCRIPTION_PAYMENT",
        status: "SUCCESS",
        amount: payment.amount,
        currency: payment.currency,
        providerReference: `checkout:${session.id}`,
        description: `Initial ${intent.plan.name} subscription payment`,
      },
    });

    await tx.registrationIntent.update({
      where: { id: intent.id },
      data: {
        status: "COMPLETED",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscription.id,
        organizationId: organization.id,
      },
    });
  });
};

const updateRegistrationFromSession = async (
  session: Stripe.Checkout.Session,
  status: "FAILED" | "EXPIRED",
) => {
  const registrationId =
    session.metadata?.registrationIntentId ?? session.client_reference_id;

  if (!registrationId) {
    return;
  }

  await prisma.registrationIntent.updateMany({
    where: {
      id: registrationId,
      status: { not: "COMPLETED" },
    },
    data: { status },
  });
};

const handleEvent = async (event: Stripe.Event) => {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      await activateRegistration(session.id);
      break;
    }

    case "checkout.session.async_payment_failed": {
      const session = event.data.object as Stripe.Checkout.Session;
      await updateRegistrationFromSession(session, "FAILED");
      break;
    }

    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      await updateRegistrationFromSession(session, "EXPIRED");
      break;
    }

    default:
      break;
  }
};

export const processStripeWebhook = async (event: Stripe.Event) => {
  const claim = await claimWebhookEvent(event);

  if (claim === "processed") {
    return { duplicate: true };
  }

  try {
    await handleEvent(event);
    await markWebhookProcessed(event.id);

    return { duplicate: false };
  } catch (error) {
    await markWebhookFailed(event.id, error);
    throw error;
  }
};
