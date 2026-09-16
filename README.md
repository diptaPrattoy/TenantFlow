# TenantFlow

TenantFlow is a multi-tenant SaaS subscription platform for organizations. Each organization has its own users, subscription, payment history, and transaction history while platform administrators manage the system globally.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL on Neon
- **ORM:** Prisma ORM
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

## Neon Connection Setup

TenantFlow uses two Neon connection strings:

- `DATABASE_URL` — pooled connection used by the running Express API
- `DIRECT_URL` — direct connection used by Prisma migrations

Create `backend/.env` from the example file:

```powershell
Copy-Item backend/.env.example backend/.env
```

Then replace the placeholder values with the connection strings from your Neon project.

Example:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DATABASE?sslmode=require
DIRECT_URL=postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DATABASE?sslmode=require
```

Do not commit `.env`.

## Getting Started

### 1. Install dependencies

From the repository root:

```bash
npm install
```

Create the backend environment file before generating Prisma Client:

```powershell
Copy-Item backend/.env.example backend/.env
```

Add your Neon connection strings, then generate Prisma Client:

```bash
npm run db:generate
```

### 2. Apply the database migration

```bash
npm run db:deploy
```

The initial migration creates the tables, enums, indexes, unique constraints, and foreign keys defined in `backend/prisma/schema.prisma`.

### 3. Seed the plans

```bash
npm run db:seed
```

This creates two development plans:

- Starter — $19/month
- Professional — $49/month

Stripe product and price IDs will be added when Stripe integration is implemented.

### 4. Check the database connection

```bash
npm run db:check
```

Expected output:

```text
Database connection successful.
```

### 5. Start the backend

```bash
npm run dev:backend
```

API base URL:

```text
http://localhost:5000/api/v1
```

Health check:

```text
GET /api/v1/health
```

### 6. Start the frontend

In another terminal:

```bash
npm run dev:frontend
```

Frontend URL:

```text
http://localhost:3000
```

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

For future schema changes during development, create a new migration from the backend workspace:

```bash
cd backend
npm run db:migrate -- --name describe_the_change
```

## API Convention

Application routes use the `/api/v1` prefix.

```text
GET /api/v1/health
```

The `postman/` folder contains the API collection and local environment. Import both files into Postman. The collection will grow with each backend feature so requests stay in sync with the code.
