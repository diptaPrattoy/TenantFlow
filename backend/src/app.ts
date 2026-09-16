import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { notFoundHandler } from "./middleware/not-found.middleware.js";
import { apiRouter } from "./routes/index.js";

export const createApp = () => {
  const app = express();

  app.disable("x-powered-by");

  app.use(
    cors({
      origin: env.frontendUrl,
      credentials: true,
    }),
  );

  // Important: the Stripe webhook route will be mounted above the normal
  // JSON body parser in the payments commit because Stripe signature
  // verification requires access to the raw request body.
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/", (_req, res) => {
    res.status(200).json({
      success: true,
      message: "TenantFlow API",
      health: "/api/v1/health",
    });
  });

  app.use("/api/v1", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export const app = createApp();
