# TenantFlow

TenantFlow is a multi-tenant SaaS subscription platform where organizations register through paid Stripe onboarding, manage their own members and subscription, and remain isolated from every other tenant. A separate Platform Admin panel provides platform-wide organization, plan, transaction, and revenue visibility.

## Tech stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS, TanStack Query
- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL on Neon
- **ORM:** Prisma
- **Authentication:** JWT + bcrypt
- **Validation:** Zod
- **Payments:** Stripe Checkout, Stripe Billing Portal, Stripe webhooks
- **Email:** Nodemailer over SMTP
- **Tests:** Vitest

## Repository structure

```text
TenantFlow/
├── frontend/            # Next.js application
├── backend/             # Express API, Prisma schema, migrations and tests
├── postman/             # Final API collection and local environment
├── package.json
└── README.md
```

## Architecture

```text
Browser / Next.js
       │
       │ HTTPS / REST
       ▼
Express API
  │    │     │
  │    │     ├──────────────► SMTP provider
  │    │
  │    └────────────────────► Stripe
  │                              │
  │                              │ verified webhooks
  │                              ▼
  └────────────────────────► Prisma
                                 │
                                 ▼
                         PostgreSQL / Neon
```

The frontend never decides which tenant a protected organization request belongs to. The backend authenticates the JWT, reloads the current user from PostgreSQL, derives `organizationId` from that user, and scopes tenant-owned queries with that trusted value.

## Core roles

### Platform Admin

- View platform statistics
- Search/filter organizations
- Inspect organization members, subscriptions, payments and transactions
- Suspend/reactivate organizations
- Create, edit, enable and disable plans
- View/filter platform-wide transactions

### Organization Admin

- Edit organization profile
- Invite members
- Change another member's role
- Remove another member
- View current subscription and history
- Upgrade/downgrade/cancel subscription
- Manage payment method through Stripe Billing Portal
- View payment history and invoice links
- View tenant transaction history
- Manage own profile/password

An Organization Admin cannot remove themselves or change their own organization role. If another admin removes a signed-in account, the backend rejects that user's next protected request and the frontend clears the stale session.

### Organization Member

- View/edit own profile
- Change password
- View basic organization information and plan name
- No member management, billing, subscription-control, payment or transaction access

## Database design

Main tables:

- `organizations`
- `users`
- `plans`
- `registration_intents`
- `subscriptions`
- `subscription_events`
- `payments`
- `transactions`
- `invitations`
- `password_reset_tokens`
- `webhook_events`

Money is stored as an integer in the smallest currency unit. For example, `$19.00` is stored as `1900`.

### Why registration intents exist

TenantFlow uses paid onboarding. A real organization is not activated before Stripe confirms payment.

```text
Signup details
     ↓
RegistrationIntent
     ↓
Stripe Checkout
     ↓
Verified webhook
     ↓
Prisma transaction
     ├── Organization
     ├── ORG_ADMIN user
     ├── Subscription
     ├── Subscription event
     ├── Payment
     ├── Transaction
     └── RegistrationIntent → COMPLETED
```

If checkout is abandoned, the registration remains pending/expired rather than leaving an active organization behind.

## Multi-tenant isolation

Tenant isolation is enforced server-side.

```text
Bearer token
    ↓
JWT verification
    ↓
Load current user from PostgreSQL
    ↓
user.organizationId
    ↓
req.tenant.organizationId
    ↓
organization-scoped Prisma query
```

Organization routes do not trust `organizationId` supplied through a request body or query string. Member updates also combine the requested member ID with the authenticated tenant ID, so knowing a user UUID from another organization does not grant access to that user.

Platform Admin accounts have no organization context and use separate platform routes.

## Authentication and access control

Passwords are hashed with bcrypt. Login returns a short-lived JWT. The token identifies the user, but the backend reloads the current user from PostgreSQL on protected requests so role changes, removals, user suspension, or organization suspension are reflected immediately instead of trusting stale authorization data embedded in a token.

Sensitive auth/invitation/registration endpoints use rate limiting and Zod input validation.

The frontend also guards role-specific routes, but backend authorization remains the security boundary.

## Stripe payment flow

### Initial registration

1. User selects an active plan.
2. The API creates a `registration_intent` and Stripe Checkout Session.
3. The browser completes payment on Stripe Checkout.
4. Stripe sends a webhook to `/api/v1/webhooks/stripe`.
5. The API verifies the Stripe signature against the raw request body.
6. TenantFlow verifies the checkout session, plan, amount and currency server-side.
7. A Prisma transaction atomically creates the tenant records and activates the registration.
8. The frontend success screen polls registration status until it becomes `COMPLETED`.

The success redirect itself is never trusted as proof of payment.

### Ongoing billing

Organization Admins can change plans, schedule cancellation, and open Stripe Billing Portal for payment-method management. Invoice webhooks maintain payment history, transaction history and subscription status.

TenantFlow never stores card numbers, CVV values or full card credentials.

## Webhook idempotency

Each Stripe event ID is recorded in `webhook_events`.

- A new event is claimed and processed.
- A previously `PROCESSED` event returns successfully without repeating business effects.
- A failed event can be retried.
- A stale in-progress event can be reclaimed.

Unique provider references and Stripe IDs provide additional duplicate protection around payment records.

## Database transaction and rollback approach

Initial payment activation performs all related writes inside one `prisma.$transaction(...)` call. If creating any required record fails, PostgreSQL rolls the transaction back and the registration is not partially activated.

The webhook record is marked `FAILED` outside that transaction so Stripe can retry the event safely.

The automated test suite includes a forced activation failure to verify this rollback/error path.

## Email notifications

SMTP notifications are sent for:

- Member invitation
- Password reset
- Payment success
- Payment failure
- Subscription upgrade
- Subscription downgrade
- Subscription cancellation
- Subscription expiring soon

Email delivery occurs after important database/payment state changes. An SMTP outage does not roll back a successful Stripe payment.

Expiry reminders can be run with:

```bash
npm run notifications:expiring
```

## Security notes

- bcrypt password hashing
- JWT expiration
- Current user/role/status reloaded from PostgreSQL for protected requests
- Server-side role guards
- Server-side tenant scoping
- Zod validation
- Rate limiting on sensitive endpoints
- Stripe webhook signature verification
- Raw Stripe webhook body preserved before `express.json()`
- No card/CVV storage
- Environment variables for secrets
- Hashed invitation and password-reset tokens
- Idempotent Stripe event handling
- Atomic payment activation with Prisma transactions
- Generic API error responses instead of leaking internal exceptions

## Environment variables

Copy the examples:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Important backend values:

```env
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:3000

DATABASE_URL=postgresql://...-pooler.../neondb?sslmode=require
DIRECT_URL=postgresql://.../neondb?sslmode=require

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN_SECONDS=3600

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-google-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=TenantFlow
```

Frontend:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
```

Never commit real `.env` files or live secrets.

## Local setup

From the repository root:

```bash
npm install
npm run db:generate
npm run db:deploy
npm run db:seed
npm run stripe:sync-plans
```

Start the API:

```bash
npm run dev:backend
```

Start the frontend in a second terminal:

```bash
npm run dev:frontend
```

Frontend:

```text
http://localhost:3000
```

API:

```text
http://localhost:5000/api/v1
```

### Local Stripe webhooks

Run Stripe CLI in another terminal:

```bash
stripe listen --api-key YOUR_SK_TEST_KEY --forward-to http://localhost:5000/api/v1/webhooks/stripe
```

Copy the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET` and restart the backend.

A standard successful test card is:

```text
4242 4242 4242 4242
Any future expiry
Any 3-digit CVC
```

## Development/reviewer credentials

The seed script creates three local accounts using values from `backend/.env`.

Default example credentials from `.env.example`:

```text
Platform Admin
admin@tenantflow.local
ChangeMe123!

Organization Admin
orgadmin@tenantflow.local
ChangeMe123!

Organization Member
member@tenantflow.local
ChangeMe123!
```

The seeded organization is useful for role/tenant testing. Stripe billing actions should be tested with an Organization Admin created through the paid registration flow because that organization has real Stripe test customer/subscription IDs.

## Automated tests

The focused test suite covers the assessment's high-risk behavior:

- Authentication
- Invalid/removed sessions
- Role authorization
- Tenant context enforcement
- Tenant-scoped member mutation
- Successful Stripe registration activation
- Duplicate webhook handling
- Transaction rollback/error handling

Run:

```bash
npm test
```

The goal is not full coverage; the tests target the areas where a failure could cause unauthorized access, cross-tenant data exposure, or incorrect billing state.

## Typecheck and production build

```bash
npm run typecheck
npm run build
```

## Postman collection

The final collection is committed under:

```text
postman/TenantFlow.postman_collection.json
postman/TenantFlow.local.postman_environment.json
```

Import both files into Postman and select the **TenantFlow Local** environment. The collection contains the role logins and the main auth, registration, organization, billing, admin and profile flows used during development.

## Main API groups

```text
/api/v1/auth
/api/v1/plans
/api/v1/registration
/api/v1/invitations
/api/v1/profile
/api/v1/organization
/api/v1/billing
/api/v1/admin
/api/v1/webhooks/stripe
```

## AI usage

AI tools were used as a development assistant for implementation planning, boilerplate generation, debugging TypeScript/Stripe integration issues, reviewing edge cases, and improving documentation. Each feature was integrated incrementally, tested locally, and reviewed so the project can be explained and modified without relying on generated output during the review call.

## Known limitations

- Access tokens are stored in browser `localStorage` for this assessment. A production version would preferably move to secure HttpOnly cookies with a refresh/session strategy.
- Expiry reminders are implemented as a runnable job (`npm run notifications:expiring`) rather than a hosted scheduler/worker because deployment is outside the required scope.
- Stripe Billing Portal is used for payment-method management instead of building custom card-management UI.
- Invoice downloads use Stripe-hosted invoice URLs/PDFs. Custom PDF invoice generation is not implemented because it is an optional bonus.
- Per-organization custom SMTP configuration is not implemented because it is an optional bonus.
- No CI/CD workflow or live deployment is included because those are not required for the core assessment.

## Submission walkthrough focus

For the product video, the shortest useful path is:

1. Register a new organization and choose a plan.
2. Pay in Stripe test Checkout.
3. Show webhook-confirmed activation and Organization Admin login.
4. Invite/member-manage inside the organization.
5. Show billing/payment/transaction history.
6. Log in as Organization Member to demonstrate restricted access.
7. Log in as Platform Admin to show organizations, plans, stats and transactions.

For the code video, focus on:

1. `auth.middleware.ts`
2. `tenant.middleware.ts`
3. organization-scoped service queries
4. Stripe raw webhook route
5. `webhook.service.ts` idempotency and `$transaction`
6. tests for tenant isolation, duplicate events and rollback
