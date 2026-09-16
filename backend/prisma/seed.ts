import { prisma } from "../src/lib/prisma.js";

const plans = [
  {
    name: "Starter",
    description: "For small teams getting started with TenantFlow.",
    priceAmount: 1900,
    currency: "USD",
    billingInterval: "MONTHLY" as const,
    features: {
      members: 5,
      support: "Standard",
      reports: false,
    },
  },
  {
    name: "Professional",
    description: "For growing teams that need higher limits and reporting.",
    priceAmount: 4900,
    currency: "USD",
    billingInterval: "MONTHLY" as const,
    features: {
      members: 25,
      support: "Priority",
      reports: true,
    },
  },
];

try {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        description: plan.description,
        priceAmount: plan.priceAmount,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        features: plan.features,
        isActive: true,
      },
      create: plan,
    });
  }

  console.log("Seeded Starter and Professional plans.");
} catch (error) {
  console.error("Database seed failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
