import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";
import { ApiError } from "../errors/api-error.js";
import type {
  CreatePlanInput,
  OrganizationStatusInput,
  UpdatePlanInput,
} from "../schemas/admin.schema.js";

const intervalToStripe = (interval: "MONTHLY" | "YEARLY") =>
  interval === "MONTHLY" ? "month" : "year";

export const getAdminStats = async () => {
  const [
    totalOrganizations,
    totalUsers,
    activeSubscriptions,
    failedPayments,
    revenue,
    recentSignups,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count({ where: { status: { not: "REMOVED" } } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.payment.aggregate({
      where: { status: "SUCCESS" },
      _sum: { amount: true },
    }),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        subscription: {
          select: { plan: { select: { name: true } } },
        },
      },
    }),
  ]);

  return {
    totalOrganizations,
    totalUsers,
    activeSubscriptions,
    totalRevenueAmount: revenue._sum.amount ?? 0,
    revenueCurrency: "USD",
    failedPaymentCount: failedPayments,
    recentSignups,
  };
};

export const getOrganizations = async (filters: {
  search?: string;
  status?: "ACTIVE" | "TRIAL" | "SUSPENDED" | "CANCELLED";
  planId?: string;
}) => {
  return prisma.organization.findMany({
    where: {
      ...(filters.search
        ? {
            name: {
              contains: filters.search,
              mode: "insensitive",
            },
          }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.planId
        ? {
            subscription: {
              is: { planId: filters.planId },
            },
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
      _count: { select: { users: true } },
      subscription: {
        select: {
          status: true,
          currentPeriodEnd: true,
          plan: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getOrganizationDetails = async (organizationId: string) => {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: {
        where: { status: { not: "REMOVED" } },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      subscription: {
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
      },
      payments: { orderBy: { createdAt: "desc" } },
      transactions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!organization) {
    throw new ApiError(404, "Organization not found.");
  }

  return organization;
};

export const setOrganizationStatus = async (
  organizationId: string,
  input: OrganizationStatusInput,
) => {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true },
  });

  if (!organization) {
    throw new ApiError(404, "Organization not found.");
  }

  return prisma.organization.update({
    where: { id: organizationId },
    data: { status: input.status },
    select: {
      id: true,
      name: true,
      status: true,
      updatedAt: true,
    },
  });
};

export const getAdminPlans = async () =>
  prisma.plan.findMany({ orderBy: { createdAt: "asc" } });

export const createAdminPlan = async (input: CreatePlanInput) => {
  const existing = await prisma.plan.findUnique({ where: { name: input.name } });
  if (existing) {
    throw new ApiError(409, "A plan with this name already exists.");
  }

  const product = await stripe.products.create({
    name: input.name,
    description: input.description ?? undefined,
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: input.priceAmount,
    currency: input.currency.toLowerCase(),
    recurring: { interval: intervalToStripe(input.billingInterval) },
  });

  return prisma.plan.create({
    data: {
      ...input,
      description: input.description ?? null,
      stripeProductId: product.id,
      stripePriceId: price.id,
      isActive: true,
    },
  });
};

export const updateAdminPlan = async (
  planId: string,
  input: UpdatePlanInput,
) => {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan) {
    throw new ApiError(404, "Plan not found.");
  }

  let productId = plan.stripeProductId;
  if (!productId) {
    const product = await stripe.products.create({
      name: input.name ?? plan.name,
      description: input.description ?? plan.description ?? undefined,
    });
    productId = product.id;
  } else if (
    input.name !== undefined ||
    input.description !== undefined ||
    input.isActive !== undefined
  ) {
    await stripe.products.update(productId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description ?? "" }
        : {}),
      ...(input.isActive !== undefined ? { active: input.isActive } : {}),
    });
  }

  const priceChanged =
    (input.priceAmount !== undefined && input.priceAmount !== plan.priceAmount) ||
    (input.currency !== undefined && input.currency !== plan.currency) ||
    (input.billingInterval !== undefined &&
      input.billingInterval !== plan.billingInterval);

  let stripePriceId = plan.stripePriceId;
  if (priceChanged) {
    const price = await stripe.prices.create({
      product: productId,
      unit_amount: input.priceAmount ?? plan.priceAmount,
      currency: (input.currency ?? plan.currency).toLowerCase(),
      recurring: {
        interval: intervalToStripe(input.billingInterval ?? plan.billingInterval),
      },
    });
    stripePriceId = price.id;
  }

  return prisma.plan.update({
    where: { id: planId },
    data: {
      ...input,
      description:
        input.description === undefined ? undefined : input.description ?? null,
      stripeProductId: productId,
      stripePriceId,
    },
  });
};

export const getPlatformTransactions = async (filters: {
  organizationId?: string;
  status?: "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED" | "ROLLED_BACK";
  from?: Date;
  to?: Date;
}) =>
  prisma.transaction.findMany({
    where: {
      ...(filters.organizationId ? { organizationId: filters.organizationId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: filters.from } : {}),
              ...(filters.to ? { lte: filters.to } : {}),
            },
          }
        : {}),
    },
    include: {
      organization: { select: { id: true, name: true } },
      payment: {
        select: {
          id: true,
          status: true,
          invoiceUrl: true,
          invoicePdfUrl: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
