import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { ApiError } from "../errors/api-error.js";
import { env } from "../config/env.js";
import type { ChangePlanInput } from "../schemas/billing.schema.js";

const getOrganizationSubscription = async (organizationId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { plan: true },
  });

  if (!subscription) {
    throw new ApiError(404, "Subscription not found.");
  }

  return subscription;
};

export const getSubscriptionOverview = async (organizationId: string) => {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: {
      plan: true,
      events: {
        include: {
          previousPlan: { select: { id: true, name: true } },
          newPlan: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!subscription) {
    throw new ApiError(404, "Subscription not found.");
  }

  return subscription;
};

export const changeSubscriptionPlan = async (
  organizationId: string,
  input: ChangePlanInput,
) => {
  const subscription = await getOrganizationSubscription(organizationId);

  if (!subscription.stripeSubscriptionId) {
    throw new ApiError(409, "This subscription is not linked to Stripe.");
  }

  if (subscription.planId === input.planId) {
    throw new ApiError(409, "This plan is already active.");
  }

  const nextPlan = await prisma.plan.findFirst({
    where: { id: input.planId, isActive: true },
  });

  if (!nextPlan) {
    throw new ApiError(404, "Selected plan is not available.");
  }

  if (!nextPlan.stripePriceId) {
    throw new ApiError(409, "Selected plan is not configured in Stripe.");
  }

  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripeSubscriptionId,
  );
  const item = stripeSubscription.items.data[0];

  if (!item) {
    throw new ApiError(409, "Stripe subscription has no billing item.");
  }

  const updatedStripeSubscription = await stripe.subscriptions.update(
    subscription.stripeSubscriptionId,
    {
      items: [{ id: item.id, price: nextPlan.stripePriceId }],
      proration_behavior: "create_prorations",
    },
  );

  const updatedItem = updatedStripeSubscription.items.data[0];
  const eventType =
    nextPlan.priceAmount > subscription.plan.priceAmount
      ? "UPGRADED"
      : "DOWNGRADED";

  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: nextPlan.id,
        stripePriceId: nextPlan.stripePriceId,
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        currentPeriodStart: updatedItem
          ? new Date(updatedItem.current_period_start * 1000)
          : subscription.currentPeriodStart,
        currentPeriodEnd: updatedItem
          ? new Date(updatedItem.current_period_end * 1000)
          : subscription.currentPeriodEnd,
      },
      include: { plan: true },
    });

    await tx.subscriptionEvent.create({
      data: {
        organizationId,
        subscriptionId: subscription.id,
        eventType,
        previousPlanId: subscription.planId,
        newPlanId: nextPlan.id,
        metadata: {
          stripeSubscriptionId: subscription.stripeSubscriptionId,
        },
      },
    });

    return updated;
  });
};

export const cancelSubscription = async (organizationId: string) => {
  const subscription = await getOrganizationSubscription(organizationId);

  if (!subscription.stripeSubscriptionId) {
    throw new ApiError(409, "This subscription is not linked to Stripe.");
  }

  if (subscription.cancelAtPeriodEnd) {
    throw new ApiError(409, "Subscription cancellation is already scheduled.");
  }

  await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      },
      include: { plan: true },
    });

    await tx.subscriptionEvent.create({
      data: {
        organizationId,
        subscriptionId: subscription.id,
        eventType: "CANCELLED",
        previousPlanId: subscription.planId,
        metadata: {
          cancelAtPeriodEnd: true,
        },
      },
    });

    return updated;
  });
};

export const createBillingPortalSession = async (organizationId: string) => {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { stripeCustomerId: true },
  });

  if (!organization?.stripeCustomerId) {
    throw new ApiError(409, "Organization is not linked to a Stripe customer.");
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: organization.stripeCustomerId,
    return_url: env.frontendUrl,
  });

  return { url: session.url };
};

export const getPaymentHistory = async (organizationId: string) =>
  prisma.payment.findMany({
    where: { organizationId },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      invoiceUrl: true,
      invoicePdfUrl: true,
      failureReason: true,
      paidAt: true,
      refundedAt: true,
      createdAt: true,
      subscription: {
        select: {
          plan: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

export const getOrganizationTransactions = async (
  organizationId: string,
  status?: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "ROLLED_BACK",
) =>
  prisma.transaction.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
