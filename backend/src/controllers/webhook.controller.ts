import type { RequestHandler } from "express";

import { env } from "../config/env.js";
import { stripe } from "../lib/stripe.js";
import { processStripeWebhook } from "../services/webhook.service.js";

export const handleStripeWebhook: RequestHandler = async (req, res) => {
  const signature = req.header("stripe-signature");

  if (!signature || !Buffer.isBuffer(req.body)) {
    res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook request.",
    });
    return;
  }

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      env.stripeWebhookSecret,
    );
  } catch {
    res.status(400).json({
      success: false,
      message: "Invalid Stripe webhook signature.",
    });
    return;
  }

  const result = await processStripeWebhook(event);

  res.status(200).json({
    received: true,
    duplicate: result.duplicate,
  });
};
