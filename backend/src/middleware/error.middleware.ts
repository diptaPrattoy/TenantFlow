import type { ErrorRequestHandler } from "express";
import { env } from "../config/env.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);

  res.status(500).json({
    success: false,
    message: "An unexpected server error occurred.",
    ...(env.nodeEnv === "development" && error instanceof Error
      ? { error: error.message }
      : {}),
  });
};
