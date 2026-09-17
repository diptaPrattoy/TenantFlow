import type Stripe from "stripe";

import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { ApiError } from "../errors/api-error.js";
import {
  sendPaymentFailedEmail,
  sendPaymentSucceededEmail,
} from "./email.service.js";

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


const invoiceSubscriptionId = (invoice: Stripe.Invoice) => {
  const value = (invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } | null } | null;
  }).subscription ?? (invoice as Stripe.Invoice & {
    parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } | null } | null;
  }).parent?.subscription_details?.subscription;

  return expandableId(value);
};

const invoicePaymentIntentId = (invoice: Stripe.Invoice) => {
  const value = (invoice as Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null;
  }).payment_intent;

  return expandableId(value);
};

const syncSuccessfulInvoice = async (invoice: Stripe.Invoice) => {
  const stripeSubscriptionId = invoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return;

  const localSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: {
      plan: true,
      organization: {
        select: { name: true, billingEmail: true },
      },
    },
  });

  // The first invoice can arrive before checkout.session.completed creates the local subscription.
  if (!localSubscription) return;

  const existingPayment = await prisma.payment.findUnique({
    where: { stripeInvoiceId: invoice.id },
    select: { id: true, status: true },
  });
  if (existingPayment?.status === "SUCCESS") return;

  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const item = stripeSubscription.items.data[0];
  const paidAt = invoice.status_transitions.paid_at
    ? new Date(invoice.status_transitions.paid_at * 1000)
    : new Date();

  await prisma.$transaction(async (tx) => {
    const payment = existingPayment
      ? await tx.payment.update({
          where: { id: existingPayment.id },
          data: {
            amount: invoice.amount_paid,
            currency: invoice.currency.toUpperCase(),
            status: "SUCCESS",
            stripePaymentIntentId: invoicePaymentIntentId(invoice),
            invoiceUrl: invoice.hosted_invoice_url ?? null,
            invoicePdfUrl: invoice.invoice_pdf ?? null,
            failureReason: null,
            paidAt,
          },
        })
      : await tx.payment.create({
          data: {
            organizationId: localSubscription.organizationId,
            subscriptionId: localSubscription.id,
            amount: invoice.amount_paid,
            currency: invoice.currency.toUpperCase(),
            status: "SUCCESS",
            stripeInvoiceId: invoice.id,
            stripePaymentIntentId: invoicePaymentIntentId(invoice),
            invoiceUrl: invoice.hosted_invoice_url ?? null,
            invoicePdfUrl: invoice.invoice_pdf ?? null,
            paidAt,
          },
        });

    const providerReference = `invoice:${invoice.id}`;
    const existingTransaction = await tx.transaction.findUnique({
      where: { providerReference },
    });

    if (existingTransaction) {
      await tx.transaction.update({
        where: { id: existingTransaction.id },
        data: {
          paymentId: payment.id,
          status: "SUCCESS",
          amount: payment.amount,
          currency: payment.currency,
          failureReason: null,
          description: `${localSubscription.plan.name} subscription payment`,
        },
      });
    } else {
      await tx.transaction.create({
        data: {
          organizationId: localSubscription.organizationId,
          paymentId: payment.id,
          type: "SUBSCRIPTION_PAYMENT",
          status: "SUCCESS",
          amount: payment.amount,
          currency: payment.currency,
          providerReference,
          description: `${localSubscription.plan.name} subscription payment`,
        },
      });
    }

    await tx.subscription.update({
      where: { id: localSubscription.id },
      data: {
        status: "ACTIVE",
        currentPeriodStart: item
          ? new Date(item.current_period_start * 1000)
          : localSubscription.currentPeriodStart,
        currentPeriodEnd: item
          ? new Date(item.current_period_end * 1000)
          : localSubscription.currentPeriodEnd,
      },
    });

    await tx.subscriptionEvent.create({
      data: {
        organizationId: localSubscription.organizationId,
        subscriptionId: localSubscription.id,
        eventType: "RENEWED",
        previousPlanId: localSubscription.planId,
        newPlanId: localSubscription.planId,
        metadata: { stripeInvoiceId: invoice.id },
      },
    });
  });

  await sendPaymentSucceededEmail({
    to: localSubscription.organization.billingEmail,
    organizationName: localSubscription.organization.name,
    planName: localSubscription.plan.name,
    amount: invoice.amount_paid,
    currency: invoice.currency,
    invoiceUrl: invoice.hosted_invoice_url,
  });
};

const syncFailedInvoice = async (invoice: Stripe.Invoice) => {
  const stripeSubscriptionId = invoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) return;

  const localSubscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    include: {
      plan: true,
      organization: {
        select: { name: true, billingEmail: true },
      },
    },
  });
  if (!localSubscription) return;

  const existingPayment = await prisma.payment.findUnique({
    where: { stripeInvoiceId: invoice.id },
    select: { id: true },
  });
  if (existingPayment) return;

  await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        organizationId: localSubscription.organizationId,
        subscriptionId: localSubscription.id,
        amount: invoice.amount_due,
        currency: invoice.currency.toUpperCase(),
        status: "FAILED",
        stripeInvoiceId: invoice.id,
        stripePaymentIntentId: invoicePaymentIntentId(invoice),
        invoiceUrl: invoice.hosted_invoice_url ?? null,
        invoicePdfUrl: invoice.invoice_pdf ?? null,
        failureReason: "Stripe invoice payment failed.",
      },
    });

    await tx.transaction.create({
      data: {
        organizationId: localSubscription.organizationId,
        paymentId: payment.id,
        type: "SUBSCRIPTION_PAYMENT",
        status: "FAILED",
        amount: payment.amount,
        currency: payment.currency,
        providerReference: `invoice:${invoice.id}`,
        description: `${localSubscription.plan.name} subscription payment failed`,
        failureReason: "Stripe invoice payment failed.",
      },
    });

    await tx.subscription.update({
      where: { id: localSubscription.id },
      data: { status: "FAILED" },
    });

    await tx.subscriptionEvent.create({
      data: {
        organizationId: localSubscription.organizationId,
        subscriptionId: localSubscription.id,
        eventType: "PAYMENT_FAILED",
        previousPlanId: localSubscription.planId,
        newPlanId: localSubscription.planId,
        metadata: { stripeInvoiceId: invoice.id },
      },
    });
  });

  await sendPaymentFailedEmail({
    to: localSubscription.organization.billingEmail,
    organizationName: localSubscription.organization.name,
    planName: localSubscription.plan.name,
    amount: invoice.amount_due,
    currency: invoice.currency,
  });
};

const syncStripeSubscription = async (subscription: Stripe.Subscription) => {
  const local = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: subscription.id },
  });
  if (!local) return;

  const item = subscription.items.data[0];
  const stripePriceId = item?.price.id ?? local.stripePriceId;
  const plan = stripePriceId
    ? await prisma.plan.findUnique({ where: { stripePriceId } })
    : null;

  const status =
    subscription.status === "active" || subscription.status === "trialing"
      ? "ACTIVE"
      : subscription.status === "canceled"
        ? "CANCELLED"
        : subscription.status === "incomplete_expired"
          ? "EXPIRED"
          : "FAILED";

  await prisma.subscription.update({
    where: { id: local.id },
    data: {
      status,
      ...(plan ? { planId: plan.id } : {}),
      stripePriceId,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodStart: item
        ? new Date(item.current_period_start * 1000)
        : local.currentPeriodStart,
      currentPeriodEnd: item
        ? new Date(item.current_period_end * 1000)
        : local.currentPeriodEnd,
    },
  });
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

  const activated = await prisma.$transaction(async (tx) => {
    const currentIntent = await tx.registrationIntent.findUnique({
      where: { id: intent.id },
      select: { status: true },
    });

    if (!currentIntent) {
      throw new ApiError(404, "Registration was not found.");
    }

    if (currentIntent.status === "COMPLETED") {
      return false;
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

    return true;
  });

  if (activated) {
    await sendPaymentSucceededEmail({
      to: intent.adminEmail,
      organizationName: intent.organizationName,
      planName: intent.plan.name,
      amount: session.amount_total ?? intent.plan.priceAmount,
      currency: session.currency ?? intent.plan.currency,
      invoiceUrl: invoice?.hosted_invoice_url,
    });
  }
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

  const intent = await prisma.registrationIntent.findUnique({
    where: { id: registrationId },
    include: { plan: true },
  });

  if (!intent || intent.status === "COMPLETED") {
    return;
  }

  await prisma.registrationIntent.update({
    where: { id: intent.id },
    data: { status },
  });

  if (status === "FAILED") {
    await sendPaymentFailedEmail({
      to: intent.adminEmail,
      organizationName: intent.organizationName,
      planName: intent.plan.name,
      amount: session.amount_total ?? intent.plan.priceAmount,
      currency: session.currency ?? intent.plan.currency,
    });
  }
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

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      await syncSuccessfulInvoice(event.data.object as Stripe.Invoice);
      break;
    }

    case "invoice.payment_failed": {
      await syncFailedInvoice(event.data.object as Stripe.Invoice);
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncStripeSubscription(event.data.object as Stripe.Subscription);
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
