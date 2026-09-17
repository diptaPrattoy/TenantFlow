import nodemailer from "nodemailer";

import { env } from "../config/env.js";

const transporter = env.smtp.enabled
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: {
        user: env.smtp.user,
        pass: env.smtp.pass,
      },
    })
  : null;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatMoney = (amount: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);

const formatDate = (date: Date) =>
  new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

const sendEmail = async (message: EmailMessage) => {
  if (!transporter) {
    console.warn(`[email] SMTP is not configured. Skipped: ${message.subject}`);
    return false;
  }

  try {
    await transporter.sendMail({
      from: {
        name: env.smtp.fromName,
        address: env.smtp.fromEmail,
      },
      ...message,
    });

    return true;
  } catch (error) {
    console.error(`[email] Failed to send "${message.subject}".`, error);
    return false;
  }
};

export const sendInvitationEmail = async (input: {
  to: string;
  organizationName: string;
  invitedByName: string;
  role: "ORG_ADMIN" | "ORG_MEMBER";
  acceptUrl: string;
  expiresAt: Date;
}) => {
  const organizationName = escapeHtml(input.organizationName);
  const invitedByName = escapeHtml(input.invitedByName);
  const role = input.role === "ORG_ADMIN" ? "Organization Admin" : "Organization Member";

  return sendEmail({
    to: input.to,
    subject: `Invitation to join ${input.organizationName}`,
    text: `${input.invitedByName} invited you to join ${input.organizationName} as ${role}. Accept the invitation before ${formatDate(input.expiresAt)}: ${input.acceptUrl}`,
    html: `
      <p><strong>${invitedByName}</strong> invited you to join <strong>${organizationName}</strong> as ${role}.</p>
      <p><a href="${escapeHtml(input.acceptUrl)}">Accept invitation</a></p>
      <p>This invitation expires on ${formatDate(input.expiresAt)}.</p>
    `,
  });
};

export const sendPasswordResetEmail = async (input: {
  to: string;
  name: string;
  resetUrl: string;
  expiresAt: Date;
}) =>
  sendEmail({
    to: input.to,
    subject: "Reset your TenantFlow password",
    text: `Hi ${input.name}, reset your password using this link: ${input.resetUrl}. The link expires at ${input.expiresAt.toISOString()}.`,
    html: `
      <p>Hi ${escapeHtml(input.name)},</p>
      <p>We received a request to reset your TenantFlow password.</p>
      <p><a href="${escapeHtml(input.resetUrl)}">Reset password</a></p>
      <p>This link expires in 30 minutes.</p>
    `,
  });

export const sendPaymentSucceededEmail = async (input: {
  to: string;
  organizationName: string;
  planName: string;
  amount: number;
  currency: string;
  invoiceUrl?: string | null;
}) => {
  const invoiceText = input.invoiceUrl ? ` Invoice: ${input.invoiceUrl}` : "";
  const invoiceHtml = input.invoiceUrl
    ? `<p><a href="${escapeHtml(input.invoiceUrl)}">View invoice</a></p>`
    : "";

  return sendEmail({
    to: input.to,
    subject: "TenantFlow payment received",
    text: `${input.organizationName}: your ${input.planName} subscription payment of ${formatMoney(input.amount, input.currency)} was successful.${invoiceText}`,
    html: `
      <p>Your payment for <strong>${escapeHtml(input.organizationName)}</strong> was successful.</p>
      <p>Plan: ${escapeHtml(input.planName)}<br />Amount: ${formatMoney(input.amount, input.currency)}</p>
      ${invoiceHtml}
    `,
  });
};

export const sendPaymentFailedEmail = async (input: {
  to: string;
  organizationName: string;
  planName: string;
  amount: number;
  currency: string;
}) =>
  sendEmail({
    to: input.to,
    subject: "TenantFlow payment failed",
    text: `${input.organizationName}: your ${input.planName} subscription payment of ${formatMoney(input.amount, input.currency)} failed. Please update your payment method and retry.`,
    html: `
      <p>We could not process the subscription payment for <strong>${escapeHtml(input.organizationName)}</strong>.</p>
      <p>Plan: ${escapeHtml(input.planName)}<br />Amount: ${formatMoney(input.amount, input.currency)}</p>
      <p>Please update your payment method and try again.</p>
    `,
  });

export const sendSubscriptionChangedEmail = async (input: {
  to: string;
  organizationName: string;
  change: "upgraded" | "downgraded";
  previousPlanName: string;
  newPlanName: string;
}) =>
  sendEmail({
    to: input.to,
    subject: `TenantFlow subscription ${input.change}`,
    text: `${input.organizationName}: your subscription was ${input.change} from ${input.previousPlanName} to ${input.newPlanName}.`,
    html: `
      <p>The subscription for <strong>${escapeHtml(input.organizationName)}</strong> was ${input.change}.</p>
      <p>${escapeHtml(input.previousPlanName)} &rarr; ${escapeHtml(input.newPlanName)}</p>
    `,
  });

export const sendSubscriptionCancelledEmail = async (input: {
  to: string;
  organizationName: string;
  planName: string;
  currentPeriodEnd: Date | null;
}) => {
  const ending = input.currentPeriodEnd
    ? ` Your access remains active until ${formatDate(input.currentPeriodEnd)}.`
    : "";

  return sendEmail({
    to: input.to,
    subject: "TenantFlow subscription cancellation scheduled",
    text: `${input.organizationName}: your ${input.planName} subscription has been scheduled for cancellation.${ending}`,
    html: `
      <p>The <strong>${escapeHtml(input.planName)}</strong> subscription for <strong>${escapeHtml(input.organizationName)}</strong> has been scheduled for cancellation.</p>
      ${input.currentPeriodEnd ? `<p>Your current billing period ends on ${formatDate(input.currentPeriodEnd)}.</p>` : ""}
    `,
  });
};

export const sendSubscriptionExpiryReminderEmail = async (input: {
  to: string;
  organizationName: string;
  planName: string;
  currentPeriodEnd: Date;
}) =>
  sendEmail({
    to: input.to,
    subject: "TenantFlow subscription expires soon",
    text: `${input.organizationName}: your ${input.planName} subscription period ends on ${formatDate(input.currentPeriodEnd)}.`,
    html: `
      <p>The <strong>${escapeHtml(input.planName)}</strong> subscription for <strong>${escapeHtml(input.organizationName)}</strong> is nearing the end of its current period.</p>
      <p>Current period end: ${formatDate(input.currentPeriodEnd)}.</p>
    `,
  });
