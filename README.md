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

For a local platform admin, set the seed values in `backend/.env` before running the seed command:

```env
SEED_PLATFORM_ADMIN_NAME=Platform Admin
SEED_PLATFORM_ADMIN_EMAIL=admin@tenantflow.local
SEED_PLATFORM_ADMIN_PASSWORD=ChangeMe123!
```

These values are only used by the development seed script. Do not commit your real `.env` file.

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

Seed the plans and optional platform admin:

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

The current collection includes:

```text
Health
Authentication
  ├── Login
  └── Current User
```

The Login request automatically saves the returned token to the `accessToken` environment variable.

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
```

For future schema changes during development:

```bash
cd backend
npm run db:migrate -- --name describe_the_change
```
