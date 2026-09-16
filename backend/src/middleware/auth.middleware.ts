import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../utils/token.js";
import { ApiError } from "../errors/api-error.js";

export const authenticate: RequestHandler = async (req, _res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(new ApiError(401, "Authentication required."));
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return next(new ApiError(401, "Authentication required."));
  }

  try {
    const { sub: userId } = verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        organizationId: true,
        name: true,
        email: true,
        role: true,
        status: true,
        organization: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return next(new ApiError(401, "Your session is no longer valid."));
    }

    if (
      user.organization &&
      (user.organization.status === "SUSPENDED" ||
        user.organization.status === "CANCELLED")
    ) {
      return next(new ApiError(403, "Organization access is currently disabled."));
    }

    req.user = {
      id: user.id,
      organizationId: user.organizationId,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      organizationStatus: user.organization?.status ?? null,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new ApiError(401, "Session expired. Please log in again."));
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return next(new ApiError(401, "Invalid authentication token."));
    }

    next(error);
  }
};
