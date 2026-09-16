import { Router } from "express";
import { acceptInvitation } from "../controllers/invitation.controller.js";
import { invitationRateLimit } from "../middleware/invitation-rate-limit.middleware.js";
import { validateBody } from "../middleware/validate.middleware.js";
import { acceptInvitationSchema } from "../schemas/organization.schema.js";

export const invitationRouter = Router();

invitationRouter.post(
  "/:token/accept",
  invitationRateLimit,
  validateBody(acceptInvitationSchema),
  acceptInvitation,
);
