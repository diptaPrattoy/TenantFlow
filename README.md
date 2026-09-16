# TenantFlow

TenantFlow is a multi-tenant SaaS subscription platform being built as a full-stack technical assessment. The application will support isolated organizations, role-based access, paid onboarding, subscription management, Stripe payments, transaction history, and administrative dashboards.

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express.js, TypeScript
- **Database:** PostgreSQL with Prisma ORM (added in the next implementation step)
- **Database hosting:** Neon (added in the next implementation step)
- **Payments:** Stripe test mode (added in a later implementation step)
- **Data fetching:** TanStack Query (added with the frontend application flows)

## Repository Structure

```text
tenantflow/
├── frontend/          # Next.js application
├── backend/           # Express REST API
├── .editorconfig
├── .gitignore
├── .nvmrc
├── package.json       # npm workspaces and root scripts
└── README.md
```

## Current Scope

This initial commit establishes the repository and application foundations only:

- npm workspace structure
- Next.js frontend with TypeScript and App Router
- Express backend with TypeScript
- API versioning under `/api/v1`
- health-check endpoint
- centralized environment configuration
- basic 404 and error handling
- CORS configuration for the frontend origin

Database, authentication, multi-tenancy, Stripe, email, and assessment-specific business logic are intentionally not included in this first commit.

## Prerequisites

- Node.js 20.9 or newer (Node.js 22 recommended)
- npm

## Getting Started

### 1. Install dependencies

From the repository root:

```bash
npm install
```

Because this repository uses npm workspaces, the command installs dependencies for both the frontend and backend.

### 2. Create local environment files

Backend:

```bash
cp backend/.env.example backend/.env
```

Frontend:

```bash
cp frontend/.env.example frontend/.env.local
```

On Windows PowerShell, you can create the files manually or use:

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

### 3. Start the backend

```bash
npm run dev:backend
```

The API runs at `http://localhost:5000`.

Health check:

```text
GET http://localhost:5000/api/v1/health
```

### 4. Start the frontend

Open another terminal:

```bash
npm run dev:frontend
```

The frontend runs at `http://localhost:3000`.

## Root Commands

```bash
npm run dev:frontend
npm run dev:backend
npm run typecheck
npm run build
```

## API Convention

All application API routes will live under:

```text
/api/v1
```

Example:

```text
GET /api/v1/health
```

## Architecture Note

The Express application is exported separately from the HTTP server. This will allow integration tests to import the app without opening a network port.

The future Stripe webhook route will be registered before the normal JSON body parser because Stripe signature verification requires the raw request body.

## Environment Variables

### Backend

| Variable | Purpose | Default |
| --- | --- | --- |
| `NODE_ENV` | Runtime environment | `development` |
| `PORT` | Express API port | `5000` |
| `FRONTEND_URL` | Allowed frontend CORS origin | `http://localhost:3000` |

### Frontend

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | Express API base URL | `http://localhost:5000/api/v1` |

## Status

**Commit 01:** Project initialization.
