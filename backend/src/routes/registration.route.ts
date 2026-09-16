import { Router } from "express";
import {
  createRegistrationCheckout,
  registrationStatus,
  retryCheckout,
} from "../controllers/registration.controller.js";
import { registrationRateLimit } from "../middleware/registration-rate-limit.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { startRegistrationSchema } from "../schemas/registration.schema.js";

export const registrationRouter = Router();

registrationRouter.post(
  "/checkout",
  registrationRateLimit,
  validateBody(startRegistrationSchema),
  createRegistrationCheckout,
);
registrationRouter.post(
  "/:registrationId/checkout",
  registrationRateLimit,
  retryCheckout,
);
registrationRouter.get("/:registrationId/status", registrationStatus);
