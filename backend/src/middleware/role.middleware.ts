import type { RequestHandler } from "express";
import type { UserRole } from "../generated/prisma/enums.js";
import { ApiError } from "../errors/api-error.js";

export const allowRoles = (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required."));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission to perform this action."));
    }

    next();
  };
