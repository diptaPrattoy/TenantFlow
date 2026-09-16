import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { ApiError } from "../errors/api-error.js";

export const validateBody = (schema: ZodType): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid request data.";

      return next(new ApiError(400, message));
    }

    req.body = result.data;
    next();
  };
