import type { UserRole } from "../generated/prisma/enums.js";
import { ApiError } from "../errors/api-error.js";
import { prisma } from "../lib/prisma.js";

const getCurrentPlan = async (organizationId: string) => {
  return prisma.subscription.findUnique({
    where: { organizationId },
    select: {
      status: true,
      currentPeriodEnd: true,
      plan: {
        select: {
          id: true,
          name: true,
          billingInterval: true,
        },
      },
    },
  });
};

export const getOrganization = async (
  organizationId: string,
  role: UserRole,
) => {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      id: true,
      name: true,
      contactEmail: true,
      contactPhone: true,
      billingEmail: true,
      status: true,
      createdAt: true,
    },
  });

  if (!organization) {
    throw new ApiError(404, "Organization not found.");
  }

  const subscription = await getCurrentPlan(organizationId);

  if (role === "ORG_MEMBER") {
    return {
      id: organization.id,
      name: organization.name,
      status: organization.status,
      plan: subscription
        ? {
            name: subscription.plan.name,
          }
        : null,
    };
  }

  return {
    ...organization,
    subscription: subscription
      ? {
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          plan: subscription.plan,
        }
      : null,
  };
};

export const getOrganizationMembers = async (organizationId: string) => {
  return prisma.user.findMany({
    where: {
      organizationId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
};
