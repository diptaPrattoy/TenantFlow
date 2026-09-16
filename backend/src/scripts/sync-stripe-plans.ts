import { prisma } from "../lib/prisma.js";
import { stripe } from "../lib/stripe.js";

const intervalMap = {
  MONTHLY: "month",
  YEARLY: "year",
} as const;

const syncPlans = async () => {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceAmount: "asc" },
  });

  for (const plan of plans) {
    let productId = plan.stripeProductId;
    let priceId = plan.stripePriceId;

    if (!productId) {
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description ?? undefined,
        metadata: {
          tenantFlowPlanId: plan.id,
        },
      });

      productId = product.id;

      await prisma.plan.update({
        where: { id: plan.id },
        data: { stripeProductId: productId },
      });
    }

    if (!priceId) {
      const price = await stripe.prices.create({
        product: productId,
        currency: plan.currency.toLowerCase(),
        unit_amount: plan.priceAmount,
        recurring: {
          interval: intervalMap[plan.billingInterval],
        },
        metadata: {
          tenantFlowPlanId: plan.id,
        },
      });

      priceId = price.id;

      await prisma.plan.update({
        where: { id: plan.id },
        data: { stripePriceId: priceId },
      });
    }

    console.log(`${plan.name}: ${priceId}`);
  }
};

syncPlans()
  .then(async () => {
    console.log("Stripe plans are ready.");
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Could not sync Stripe plans.");
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
