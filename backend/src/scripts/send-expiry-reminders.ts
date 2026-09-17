import { prisma } from "../lib/prisma.js";
import { sendSubscriptionExpiryReminderEmail } from "../services/email.service.js";

const reminderWindowDays = 3;

const run = async () => {
  const now = new Date();
  const cutoff = new Date(now.getTime() + reminderWindowDays * 24 * 60 * 60 * 1000);

  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      currentPeriodEnd: {
        gt: now,
        lte: cutoff,
      },
    },
    include: {
      plan: true,
      organization: {
        select: {
          name: true,
          billingEmail: true,
        },
      },
    },
  });

  let sent = 0;

  for (const subscription of subscriptions) {
    if (!subscription.currentPeriodEnd) continue;

    const alreadySentForCurrentPeriod =
      subscription.lastExpiryReminderAt &&
      subscription.currentPeriodStart &&
      subscription.lastExpiryReminderAt >= subscription.currentPeriodStart;

    if (alreadySentForCurrentPeriod) continue;

    const delivered = await sendSubscriptionExpiryReminderEmail({
      to: subscription.organization.billingEmail,
      organizationName: subscription.organization.name,
      planName: subscription.plan.name,
      currentPeriodEnd: subscription.currentPeriodEnd,
    });

    if (!delivered) continue;

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { lastExpiryReminderAt: new Date() },
    });

    sent += 1;
  }

  console.log(`Expiry reminders sent: ${sent}`);
};

run()
  .catch((error) => {
    console.error("Failed to send expiry reminders.", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
