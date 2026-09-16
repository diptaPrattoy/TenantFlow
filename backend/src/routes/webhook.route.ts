import { Router } from "express";
import { handleStripeWebhook } from "../controllers/webhook.controller.js";

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/", handleStripeWebhook);
