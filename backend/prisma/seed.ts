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

const seedDemoOrganization = async () => {
  const organizationName = process.env.SEED_ORGANIZATION_NAME?.trim();
  const adminName = process.env.SEED_ORG_ADMIN_NAME?.trim();
  const adminEmail = process.env.SEED_ORG_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SEED_ORG_ADMIN_PASSWORD;
  const memberName = process.env.SEED_ORG_MEMBER_NAME?.trim();
  const memberEmail = process.env.SEED_ORG_MEMBER_EMAIL?.trim().toLowerCase();
  const memberPassword = process.env.SEED_ORG_MEMBER_PASSWORD;

  if (
    !organizationName ||
    !adminName ||
    !adminEmail ||
    !adminPassword ||
    !memberName ||
    !memberEmail ||
    !memberPassword
  ) {
    console.log("Demo organization seed skipped. Seed credentials are not configured.");
    return;
  }

  const starterPlan = await prisma.plan.findUnique({
    where: { name: "Starter" },
  });

  if (!starterPlan) {
    throw new Error("Starter plan must exist before seeding the demo organization.");
  }

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    select: { organizationId: true },
  });

  const organization = existingAdmin?.organizationId
    ? await prisma.organization.update({
        where: { id: existingAdmin.organizationId },
        data: {
          name: organizationName,
          contactEmail: adminEmail,
          billingEmail: adminEmail,
          status: "ACTIVE",
        },
      })
    : await prisma.organization.create({
        data: {
          name: organizationName,
          contactEmail: adminEmail,
          billingEmail: adminEmail,
          status: "ACTIVE",
        },
      });

  const [adminPasswordHash, memberPasswordHash] = await Promise.all([
    hashPassword(adminPassword),
    hashPassword(memberPassword),
  ]);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      organizationId: organization.id,
      name: adminName,
      passwordHash: adminPasswordHash,
      role: "ORG_ADMIN",
      status: "ACTIVE",
    },
    create: {
      organizationId: organization.id,
      name: adminName,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "ORG_ADMIN",
      status: "ACTIVE",
    },
  });

  await prisma.user.upsert({
    where: { email: memberEmail },
    update: {
      organizationId: organization.id,
      name: memberName,
      passwordHash: memberPasswordHash,
      role: "ORG_MEMBER",
      status: "ACTIVE",
    },
    create: {
      organizationId: organization.id,
      name: memberName,
      email: memberEmail,
      passwordHash: memberPasswordHash,
      role: "ORG_MEMBER",
      status: "ACTIVE",
    },
  });

  const periodStart = new Date();
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 30);

  await prisma.subscription.upsert({
    where: { organizationId: organization.id },
    update: {
      planId: starterPlan.id,
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false,
      cancelledAt: null,
    },
    create: {
      organizationId: organization.id,
      planId: starterPlan.id,
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  console.log(`Seeded demo organization: ${organizationName}`);
  console.log(`Seeded organization admin: ${adminEmail}`);
  console.log(`Seeded organization member: ${memberEmail}`);
};

try {
  await seedPlans();
  await seedPlatformAdmin();
  await seedDemoOrganization();
} catch (error) {
  console.error("Database seed failed.");
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
