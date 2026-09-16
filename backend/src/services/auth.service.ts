import { prisma } from "../lib/prisma.js";
import { ApiError } from "../errors/api-error.js";
import { comparePassword } from "../utils/password.js";
import { createAccessToken } from "../utils/token.js";
import type { LoginInput } from "../schemas/auth.schema.js";
import { env } from "../config/env.js";

const publicUserSelect = {
  id: true,
  organizationId: true,
  name: true,
  email: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export const login = async ({ email, password }: LoginInput) => {
  const normalizedEmail = email.toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      organization: {
        select: {
          status: true,
        },
      },
    },
  });

  if (!user || !(await comparePassword(password, user.passwordHash))) {
    throw new ApiError(401, "Invalid email or password.");
  }

  if (user.status !== "ACTIVE") {
    throw new ApiError(403, "This account is not active.");
  }

  if (
    user.organization &&
    (user.organization.status === "SUSPENDED" ||
      user.organization.status === "CANCELLED")
  ) {
    throw new ApiError(403, "Organization access is currently disabled.");
  }

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: publicUserSelect,
  });

  return {
    accessToken: createAccessToken(user.id),
    expiresInSeconds: env.jwtExpiresInSeconds,
    user: updatedUser,
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user) {
    throw new ApiError(404, "User not found.");
  }

  return user;
};

