import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../errors/api-error.js";
import { prisma } from "../lib/prisma.js";
import type { AcceptInvitationInput } from "../schemas/organization.schema.js";
import { hashPassword } from "../utils/password.js";

const hashInvitationToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const acceptOrganizationInvitation = async (
  token: string,
  input: AcceptInvitationInput,
) => {
  const tokenHash = hashInvitationToken(token);

  const invitation = await prisma.invitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      organizationId: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      organization: {
        select: {
          name: true,
          status: true,
        },
      },
    },
  });

  if (!invitation) {
    throw new ApiError(404, "Invitation not found.");
  }

  if (invitation.status !== "PENDING") {
    throw new ApiError(409, "This invitation is no longer available.");
  }

  if (invitation.expiresAt <= new Date()) {
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "EXPIRED" },
    });

    throw new ApiError(410, "This invitation has expired.");
  }

  if (
    invitation.organization.status === "SUSPENDED" ||
    invitation.organization.status === "CANCELLED"
  ) {
    throw new ApiError(403, "This organization is not accepting members right now.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: invitation.email },
    select: {
      id: true,
      organizationId: true,
      status: true,
    },
  });

  if (existingUser && existingUser.status !== "REMOVED") {
    throw new ApiError(409, "An account with this email already exists.");
  }

  if (
    existingUser?.organizationId &&
    existingUser.organizationId !== invitation.organizationId
  ) {
    throw new ApiError(409, "This email already belongs to another organization.");
  }

  const passwordHash = await hashPassword(input.password);

  const member = await prisma.$transaction(async (tx) => {
    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            organizationId: invitation.organizationId,
            name: input.name,
            passwordHash,
            role: invitation.role,
            status: "ACTIVE",
          },
          select: {
            id: true,
            organizationId: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        })
      : await tx.user.create({
          data: {
            organizationId: invitation.organizationId,
            name: input.name,
            email: invitation.email,
            passwordHash,
            role: invitation.role,
            status: "ACTIVE",
          },
          select: {
            id: true,
            organizationId: true,
            name: true,
            email: true,
            role: true,
            status: true,
          },
        });

    await tx.invitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    return user;
  });

  return {
    member,
    organization: {
      id: invitation.organizationId,
      name: invitation.organization.name,
    },
  };
};

export const createInvitationToken = () => {
  const token = randomBytes(32).toString("hex");

  return {
    token,
    tokenHash: hashInvitationToken(token),
    acceptUrl: `${env.frontendUrl}/accept-invitation?token=${token}`,
  };
};
