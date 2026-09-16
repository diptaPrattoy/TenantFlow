import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { hashPassword } from "../src/utils/password.js";

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

const seedPlans = async () => {
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
};

const seedPlatformAdmin = async () => {
  const name = process.env.SEED_PLATFORM_ADMIN_NAME?.trim();
  const email = process.env.SEED_PLATFORM_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_PLATFORM_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    console.log("Platform admin seed skipped. Seed credentials are not configured.");
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    update: {
      name,
      passwordHash,
      role: "PLATFORM_ADMIN",
      status: "ACTIVE",
      organizationId: null,
    },
    create: {
      name,
      email,
      passwordHash,
      role: "PLATFORM_ADMIN",
      status: "ACTIVE",
    },
  });

  console.log(`Seeded platform admin: ${email}`);
};

try {
  await seedPlans();
  await seedPlatformAdmin();
} catch (error) {
  console.error("Database seed failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
