import { rateLimit } from "express-rate-limit";

export const invitationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many invitation attempts. Please try again later.",
  },
});
