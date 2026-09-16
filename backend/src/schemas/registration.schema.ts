import { z } from "zod";

export const startRegistrationSchema = z.object({
  organizationName: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters.")
    .max(150, "Organization name must be 150 characters or fewer."),
  adminName: z
    .string()
    .trim()
    .min(2, "Admin name must be at least 2 characters.")
    .max(150, "Admin name must be 150 characters or fewer."),
  adminEmail: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .max(72, "Password must be 72 characters or fewer."),
  planId: z.string().uuid("Choose a valid plan."),
});

export type StartRegistrationInput = z.infer<typeof startRegistrationSchema>;
