import { z } from "zod";

const featureValueSchema = z.union([z.string(), z.number(), z.boolean()]);

export const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional().nullable(),
  priceAmount: z.number().int().positive("Price must be greater than zero."),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]),
  features: z.record(z.string(), featureValueSchema),
});

export const updatePlanSchema = createPlanSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const organizationStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type OrganizationStatusInput = z.infer<typeof organizationStatusSchema>;
