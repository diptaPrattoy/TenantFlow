import { z } from "zod";

export const changePlanSchema = z.object({
  planId: z.string().uuid("A valid plan ID is required."),
});

export type ChangePlanInput = z.infer<typeof changePlanSchema>;
