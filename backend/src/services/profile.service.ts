import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { ApiError } from "../errors/api-error.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateProfileInput,
} from "../schemas/profile.schema.js";

const profileSelect = {
  id: true,
  organizationId: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: profileSelect,
  });

  if (!user) throw new ApiError(404, "User not found.");
  return user;
};

export const updateProfile = async (userId: string, input: UpdateProfileInput) =>
  prisma.user.update({
    where: { id: userId },
    data: { name: input.name },
    select: profileSelect,
  });

export const changePassword = async (
  userId: string,
  input: ChangePasswordInput,
) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "User not found.");

  const matches = await comparePassword(input.currentPassword, user.passwordHash);
  if (!matches) throw new ApiError(400, "Current password is incorrect.");

  if (await comparePassword(input.newPassword, user.passwordHash)) {
    throw new ApiError(400, "New password must be different from the current password.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
};

export const createPasswordReset = async (input: ForgotPasswordInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, status: true },
  });

  // Keep the same public response whether the email exists or not.
  if (!user || user.status !== "ACTIVE") {
    return {};
  }

  await prisma.passwordResetToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt,
    },
  });

  return env.nodeEnv === "development"
    ? {
        resetToken: token,
        resetUrl: `${env.frontendUrl}/reset-password?token=${token}`,
        expiresAt,
      }
    : {};
};

export const resetPassword = async (input: ResetPasswordInput) => {
  const tokenHash = hashToken(input.token);
  const token = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!token || token.usedAt || token.expiresAt <= new Date()) {
    throw new ApiError(400, "Password reset token is invalid or expired.");
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    }),
  ]);
};
