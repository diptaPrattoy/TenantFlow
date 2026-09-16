# TenantFlow

TenantFlow is a multi-tenant SaaS subscription platform for organizations. Each organization has its own users, subscription, payment history, and transaction history while platform administrators manage the system globally.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL on Neon
- **ORM:** Prisma ORM
- **Authentication:** JWT and bcrypt password hashing
- **Validation:** Zod
- **Payments:** Stripe test mode
- **Frontend data fetching:** TanStack Query

## Project Structure

```text
tenantflow/
├── frontend/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   └── src/
│       ├── controllers/
│       ├── middleware/
│       ├── routes/
│       ├── schemas/
│       ├── services/
│       └── utils/
├── postman/
├── package.json
└── README.md
```

## Database Design

The database is built around organization-level data isolation.

### Main tables

- `organizations` — tenant accounts
- `users` — platform admins, organization admins, and organization members
- `plans` — subscription plans managed by platform admins
- `registration_intents` — signup information kept before Stripe confirms the initial payment
- `subscriptions` — an organization's current subscription
- `subscription_events` — subscription history such as upgrades, downgrades, renewals, and cancellations
- `payments` — Stripe payment records for an organization
- `transactions` — application-level financial history, including failed and rolled-back operations
- `invitations` — member invitations
- `password_reset_tokens` — password reset tokens
- `webhook_events` — Stripe webhook processing records used for idempotency

Money is stored as an integer in the smallest currency unit. For example, `$19.00` is stored as `1900`.

## Registration Model

An organization is not created as active before its first payment is confirmed.

```text
Signup details
    ↓
RegistrationIntent
    ↓
Stripe Checkout
    ↓
Verified Stripe webhook
    ↓
Database transaction
    ├── Organization
    ├── Organization Admin
    ├── Subscription
    ├── Payment
    └── Transaction
```

This avoids leaving an active organization behind when checkout is abandoned or payment fails.

## Authentication

Users log in with email and password. Passwords are stored as bcrypt hashes and the API returns a short-lived JWT access token.

The token identifies the user by ID. Protected requests then load the current user from the database so role changes, account suspension, and organization suspension take effect without trusting old role or tenant information from a token.

Current authentication routes:

```text
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

`/auth/me` requires:

```text
Authorization: Bearer <access-token>
```

Login is rate-limited and request bodies are validated with Zod.

## Paid Registration and Stripe Checkout

Public registration is staged in `registration_intents`. Creating a checkout does not create an organization or user account.

Current public billing routes:

```text
GET  /api/v1/plans
POST /api/v1/registration/checkout
POST /api/v1/registration/:registrationId/checkout
GET  /api/v1/registration/:registrationId/status
```

`POST /registration/checkout` validates the signup data, hashes the admin password, creates a pending registration intent, and creates a Stripe Checkout Session in subscription mode. The API returns Stripe's hosted checkout URL to the frontend.

If checkout is abandoned, the retry route reuses the existing open Stripe session. If that session has expired, a new session is created. A completed session is not replaced while payment confirmation is still pending.

The real `Organization`, `ORG_ADMIN` user, subscription, payment, and transaction records are not created by the checkout endpoint. They are created only after Stripe sends a verified payment event.

## Stripe Webhook Processing

The Stripe webhook endpoint is:

```text
POST /api/v1/webhooks/stripe
```

It is mounted before the normal JSON body parser so Stripe signature verification receives the original raw request body. Webhook events are recorded in `webhook_events` by Stripe event ID before business logic runs. A processed event is ignored if Stripe sends it again, while a failed event can be retried.

For a successful initial subscription payment, the backend retrieves the Checkout Session from Stripe and verifies the registration reference, selected plan, amount, currency, customer, and subscription. It then uses one Prisma transaction to create:

```text
Organization
Organization Admin
Subscription
Subscription Event
Payment
Transaction
RegistrationIntent -> COMPLETED
```

If any database operation fails, the Prisma transaction is rolled back and the webhook event is marked as failed so Stripe can retry it.

Checkout expiration and asynchronous payment failure events update the pending registration without creating an active organization.

### Stripe test setup

Add the Stripe test-mode key and webhook signing secret to `backend/.env`:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

After seeding the local plans, create their matching Stripe products and recurring prices once:

```bash
npm run stripe:sync-plans
```

The command stores the returned Stripe product and price IDs on each plan. It is safe to run again because plans that already have Stripe IDs are skipped.

For local webhook testing, run Stripe CLI in a separate terminal:

```bash
stripe listen --forward-to localhost:5000/api/v1/webhooks/stripe
```

Copy the `whsec_...` signing secret printed by the CLI into `STRIPE_WEBHOOK_SECRET`, restart the backend, then complete Checkout with a Stripe test card. After the webhook succeeds, the registration status becomes `COMPLETED` and the newly created Organization Admin can log in.

## Tenant Isolation

Organization routes never accept a tenant ID from the request body or query string. After JWT verification, the API reloads the user from PostgreSQL and creates a request-scoped tenant context from `user.organizationId`.

```text
JWT user ID
    ↓
Load current user from PostgreSQL
    ↓
user.organizationId
    ↓
req.tenant.organizationId
    ↓
organization-scoped Prisma query
```

Current organization routes:

```text
GET /api/v1/organization
GET /api/v1/organization/members
```

`GET /organization` is available to Organization Admins and Organization Members. Members receive only basic organization information and the current plan name. Billing/contact fields are not returned to members.

`GET /organization/members` is restricted to Organization Admins and always filters users by the authenticated admin's organization ID.

Platform Admin accounts do not have an organization context and cannot use tenant-only routes.

For future routes that receive a resource ID such as a member, payment, or invitation ID, the resource will be queried together with `organizationId` rather than trusting the resource ID by itself.

## Environment Setup

Create `backend/.env` from the example file:

```powershell
Copy-Item backend/.env.example backend/.env
```

Set both Neon connection strings:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DATABASE?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DATABASE?sslmode=require
```

`DATABASE_URL` is the pooled connection used by the running API. `DIRECT_URL` is the direct connection used by Prisma migrations.

Add a JWT secret of at least 32 characters:

```env
JWT_SECRET=replace-this-with-a-long-random-secret
JWT_EXPIRES_IN_SECONDS=3600
```

The seed script can create the three accounts used while developing and reviewing the application:

```env
SEED_PLATFORM_ADMIN_NAME=Platform Admin
SEED_PLATFORM_ADMIN_EMAIL=admin@tenantflow.local
SEED_PLATFORM_ADMIN_PASSWORD=ChangeMe123!

SEED_ORGANIZATION_NAME=Demo Organization
SEED_ORG_ADMIN_NAME=Organization Admin
SEED_ORG_ADMIN_EMAIL=orgadmin@tenantflow.local
SEED_ORG_ADMIN_PASSWORD=ChangeMe123!
SEED_ORG_MEMBER_NAME=Organization Member
SEED_ORG_MEMBER_EMAIL=member@tenantflow.local
SEED_ORG_MEMBER_PASSWORD=ChangeMe123!
```

The demo organization receives an active Starter subscription so tenant-scoped routes can be tested before Stripe onboarding is implemented. This is development seed data only; the real registration flow still creates organizations only after a verified Stripe payment.

Do not commit your real `.env` file.

## Getting Started

Install dependencies from the repository root:

```bash
npm install
```

Generate Prisma Client:

```bash
npm run db:generate
```

Apply the database migration:

```bash
npm run db:deploy
```

Seed the plans and development accounts:

```bash
npm run db:seed
```

Check the Neon connection:

```bash
npm run db:check
```

Start the backend:

```bash
npm run dev:backend
```

API base URL:

```text
http://localhost:5000/api/v1
```

Start the frontend in another terminal:

```bash
npm run dev:frontend
```

Frontend URL:

```text
http://localhost:3000
```

## Postman

The `postman/` folder is used for local API testing while development is in progress. Its JSON files are currently ignored by Git and will be added to the repository with the final submission.

The current local collection includes:

```text
Health
Authentication
Plans
Registration
Organization
```

It contains separate login requests for Platform Admin, Organization Admin, and Organization Member accounts, plus organization profile/member-list requests. The collection remains ignored by Git until the final submission commit.

## Useful Commands

```bash
npm run dev:frontend
npm run dev:backend
npm run typecheck
npm run build

npm run db:generate
npm run db:deploy
npm run db:seed
npm run db:check
npm run db:studio
npm run stripe:sync-plans
```

For future schema changes during development:

```bash
cd backend
npm run db:migrate -- --name describe_the_change
```
