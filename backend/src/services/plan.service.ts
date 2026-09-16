import { prisma } from "../lib/prisma.js";

export const listPublicPlans = () =>
  prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceAmount: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      priceAmount: true,
      currency: true,
      billingInterval: true,
      features: true,
    },
  });
