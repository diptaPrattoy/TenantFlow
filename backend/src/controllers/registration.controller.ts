import type { RequestHandler } from "express";

import {
  getRegistrationStatus,
  retryRegistrationCheckout,
  startRegistration,
} from "../services/registration.service.js";
import { ApiError } from "../errors/api-error.js";

export const createRegistrationCheckout: RequestHandler = async (req, res) => {
  const result = await startRegistration(req.body);

  res.status(201).json({
    success: true,
    message: "Checkout session created.",
    data: result,
  });
};

export const retryCheckout: RequestHandler = async (req, res) => {
  const registrationId = req.params.registrationId;

  if (typeof registrationId !== "string") {
    throw new ApiError(400, "Invalid registration ID.");
  }

  const result = await retryRegistrationCheckout(registrationId);

  res.status(200).json({
    success: true,
    message: "Checkout session ready.",
    data: result,
  });
};

export const registrationStatus: RequestHandler = async (req, res) => {
  const registrationId = req.params.registrationId;

  if (typeof registrationId !== "string") {
    throw new ApiError(400, "Invalid registration ID.");
  }

  const result = await getRegistrationStatus(registrationId);

  res.status(200).json({
    success: true,
    data: result,
  });
};
