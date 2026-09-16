import { z } from "zod";

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .transform((email) => email.toLowerCase())
  .nullable()
  .optional();

export const updateOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Organization name must be at least 2 characters.")
      .max(150, "Organization name must be 150 characters or fewer.")
      .optional(),
    contactEmail: optionalEmail,
    contactPhone: z
      .string()
      .trim()
      .min(3, "Enter a valid contact phone number.")
      .max(30, "Contact phone must be 30 characters or fewer.")
      .nullable()
      .optional(),
    billingEmail: z
      .string()
      .trim()
      .email("Enter a valid billing email address.")
      .transform((email) => email.toLowerCase())
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one organization field to update.",
  });

export const inviteMemberSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((email) => email.toLowerCase()),
  role: z.enum(["ORG_ADMIN", "ORG_MEMBER"]).default("ORG_MEMBER"),
});

export const changeMemberRoleSchema = z.object({
  role: z.enum(["ORG_ADMIN", "ORG_MEMBER"]),
});

export const acceptInvitationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters.")
    .max(150, "Name must be 150 characters or fewer."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer."),
});

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type ChangeMemberRoleInput = z.infer<typeof changeMemberRoleSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
