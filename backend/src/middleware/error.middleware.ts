import type { ErrorRequestHandler } from "express";
import { env } from "../config/env.js";
import { ApiError } from "../errors/api-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message,
    });
  }

  const statusCode =
    typeof error?.statusCode === "number" ? error.statusCode : 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? "An unexpected server error occurred."
        : error?.message ?? "Request failed.",
    ...(env.nodeEnv === "development" &&
    statusCode === 500 &&
    error instanceof Error
      ? { error: error.message }
      : {}),
  });
};
