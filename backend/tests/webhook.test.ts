import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  webhookCreate,
  webhookFindUnique,
  webhookUpdate,
  webhookUpdateMany,
  registrationFindUnique,
  userFindUnique,
  transaction,
  checkoutRetrieve,
  subscriptionRetrieve,
  invoiceRetrieve,
} = vi.hoisted(() => ({
  webhookCreate: vi.fn(),
  webhookFindUnique: vi.fn(),
  webhookUpdate: vi.fn(),
  webhookUpdateMany: vi.fn(),
  registrationFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  transaction: vi.fn(),
  checkoutRetrieve: vi.fn(),
  subscriptionRetrieve: vi.fn(),
  invoiceRetrieve: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    webhookEvent: {
      create: webhookCreate,
      findUnique: webhookFindUnique,
      update: webhookUpdate,
      updateMany: webhookUpdateMany,
    },
    registrationIntent: { findUnique: registrationFindUnique },
    user: { findUnique: userFindUnique },
    subscription: { findUnique: vi.fn(), update: vi.fn() },
    payment: { findUnique: vi.fn() },
    plan: { findUnique: vi.fn() },
    $transaction: transaction,
  },
}));

vi.mock("../src/lib/stripe.js", () => ({
  stripe: {
    checkout: { sessions: { retrieve: checkoutRetrieve } },
    subscriptions: { retrieve: subscriptionRetrieve },
    invoices: { retrieve: invoiceRetrieve },
  },
}));

vi.mock("../src/services/email.service.js", () => ({
  sendPaymentSucceededEmail: vi.fn().mockResolvedValue(undefined),
  sendPaymentFailedEmail: vi.fn().mockResolvedValue(undefined),
}));

import { processStripeWebhook } from "../src/services/webhook.service.js";

const plan = {
  id: "plan-1",
  name: "Starter",
  priceAmount: 1900,
  currency: "USD",
  stripePriceId: "price_1",
};

const intent = {
  id: "registration-1",
  organizationName: "Acme Ltd",
  adminName: "Acme Admin",
  adminEmail: "admin@acme.test",
  adminPasswordHash: "hashed-password",
  planId: "plan-1",
  status: "CHECKOUT_CREATED",
  stripeCheckoutSessionId: "cs_test_1",
  plan,
};

const checkoutSession = {
  id: "cs_test_1",
  payment_status: "paid",
  metadata: {
    registrationIntentId: "registration-1",
    planId: "plan-1",
  },
  client_reference_id: "registration-1",
  amount_total: 1900,
  currency: "usd",
  customer: "cus_1",
  invoice: null,
  subscription: {
    id: "sub_1",
    items: {
      data: [
        {
          price: { id: "price_1" },
          current_period_start: 1_700_000_000,
          current_period_end: 1_702_592_000,
        },
      ],
    },
  },
};

const event = {
  id: "evt_1",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test_1" } },
} as any;

const buildTransactionClient = () => ({
  registrationIntent: {
    findUnique: vi.fn().mockResolvedValue({ status: "CHECKOUT_CREATED" }),
    update: vi.fn().mockResolvedValue({}),
  },
  organization: {
    create: vi.fn().mockResolvedValue({ id: "org-1" }),
  },
  user: {
    create: vi.fn().mockResolvedValue({ id: "user-1" }),
  },
  subscription: {
    create: vi.fn().mockResolvedValue({ id: "local-sub-1" }),
  },
  subscriptionEvent: {
    create: vi.fn().mockResolvedValue({}),
  },
  payment: {
    create: vi.fn().mockResolvedValue({
      id: "payment-1",
      amount: 1900,
      currency: "USD",
    }),
  },
  transaction: {
    create: vi.fn().mockResolvedValue({}),
  },
});

describe("Stripe webhook processing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webhookCreate.mockResolvedValue({ id: "local-event" });
    webhookUpdate.mockResolvedValue({});
    checkoutRetrieve.mockResolvedValue(checkoutSession);
    registrationFindUnique.mockResolvedValue(intent);
    userFindUnique.mockResolvedValue(null);
  });

  it("does not process a Stripe event twice", async () => {
    webhookCreate.mockRejectedValueOnce(new Error("unique constraint"));
    webhookFindUnique.mockResolvedValueOnce({
      id: "local-event",
      stripeEventId: "evt_1",
      status: "PROCESSED",
      updatedAt: new Date(),
    });

    const result = await processStripeWebhook(event);

    expect(result).toEqual({ duplicate: true });
    expect(checkoutRetrieve).not.toHaveBeenCalled();
  });

  it("activates a paid registration inside one database transaction", async () => {
    const tx = buildTransactionClient();
    transaction.mockImplementationOnce(async (callback: any) => callback(tx));

    const result = await processStripeWebhook(event);

    expect(result).toEqual({ duplicate: false });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.organization.create).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.subscription.create).toHaveBeenCalledTimes(1);
    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(tx.transaction.create).toHaveBeenCalledTimes(1);
    expect(tx.registrationIntent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "registration-1" },
        data: expect.objectContaining({ status: "COMPLETED" }),
      }),
    );
    expect(webhookUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: "evt_1" },
        data: expect.objectContaining({ status: "PROCESSED" }),
      }),
    );
  });

  it("marks the webhook failed when the activation transaction rolls back", async () => {
    transaction.mockRejectedValueOnce(new Error("forced transaction failure"));

    await expect(processStripeWebhook(event)).rejects.toThrow(
      "forced transaction failure",
    );

    expect(webhookUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeEventId: "evt_1" },
        data: expect.objectContaining({
          status: "FAILED",
          lastError: "forced transaction failure",
        }),
      }),
    );
  });
});
