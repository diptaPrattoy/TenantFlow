import type { UserRole } from "../generated/prisma/enums.js";
import { env } from "../config/env.js";
import { ApiError } from "../errors/api-error.js";
import { prisma } from "../lib/prisma.js";
import type {
  ChangeMemberRoleInput,
  InviteMemberInput,
  UpdateOrganizationInput,
} from "../schemas/organization.schema.js";
import { createInvitationToken } from "./invitation.service.js";

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

export const updateOrganization = async (
  organizationId: string,
  input: UpdateOrganizationInput,
) => {
  return prisma.organization.update({
    where: { id: organizationId },
    data: input,
    select: {
      id: true,
      name: true,
      contactEmail: true,
      contactPhone: true,
      billingEmail: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
};

export const getOrganizationMembers = async (organizationId: string) => {
  return prisma.user.findMany({
    where: {
      organizationId,
      status: {
        not: "REMOVED",
      },
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

export const inviteOrganizationMember = async (
  organizationId: string,
  invitedByUserId: string,
  input: InviteMemberInput,
) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      organizationId: true,
      status: true,
    },
  });

  if (existingUser && existingUser.status !== "REMOVED") {
    throw new ApiError(409, "An account with this email already exists.");
  }

  if (
    existingUser?.organizationId &&
    existingUser.organizationId !== organizationId
  ) {
    throw new ApiError(409, "This email already belongs to another organization.");
  }

  const pendingInvitation = await prisma.invitation.findFirst({
    where: {
      organizationId,
      email: input.email,
      status: "PENDING",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (pendingInvitation) {
    if (pendingInvitation.expiresAt > new Date()) {
      throw new ApiError(409, "An invitation is already pending for this email.");
    }

    await prisma.invitation.update({
      where: { id: pendingInvitation.id },
      data: { status: "EXPIRED" },
    });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { token, tokenHash, acceptUrl } = createInvitationToken();

  const invitation = await prisma.invitation.create({
    data: {
      organizationId,
      invitedByUserId,
      email: input.email,
      role: input.role,
      tokenHash,
      expiresAt,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return {
    ...invitation,
    ...(env.nodeEnv === "development"
      ? {
          inviteToken: token,
          acceptUrl,
        }
      : {}),
  };
};

export const changeOrganizationMemberRole = async (
  organizationId: string,
  currentUserId: string,
  memberId: string,
  input: ChangeMemberRoleInput,
) => {
  if (memberId === currentUserId) {
    throw new ApiError(400, "You cannot change your own organization role.");
  }

  const member = await prisma.user.findFirst({
    where: {
      id: memberId,
      organizationId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!member) {
    throw new ApiError(404, "Organization member not found.");
  }

  if (member.status === "REMOVED") {
    throw new ApiError(409, "This member has already been removed.");
  }

  return prisma.user.update({
    where: { id: member.id },
    data: { role: input.role },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      updatedAt: true,
    },
  });
};

export const removeOrganizationMember = async (
  organizationId: string,
  currentUserId: string,
  memberId: string,
) => {
  if (memberId === currentUserId) {
    throw new ApiError(400, "You cannot remove your own account from the organization.");
  }

  const member = await prisma.user.findFirst({
    where: {
      id: memberId,
      organizationId,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!member) {
    throw new ApiError(404, "Organization member not found.");
  }

  if (member.status === "REMOVED") {
    throw new ApiError(409, "This member has already been removed.");
  }

  await prisma.user.update({
    where: { id: member.id },
    data: {
      status: "REMOVED",
    },
  });
};
