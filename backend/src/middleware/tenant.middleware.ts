import type { RequestHandler } from "express";
import { ApiError } from "../errors/api-error.js";

export const requireOrganizationContext: RequestHandler = (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Authentication required."));
  }

  if (!req.user.organizationId) {
    return next(new ApiError(403, "This endpoint requires an organization account."));
  }

  req.tenant = {
    organizationId: req.user.organizationId,
  };

  next();
};
