# Setup & Development Guidelines

## 1. Monorepo Structure
We will adopt a structure that separates the Control Plane (Next.js) from the Data Plane (Node.js workers). While utilizing a tool like Turborepo is an option, we can start with a simple directory split for clarity.

```
/
├── apps/
│   ├── web/               # Next.js 15, UI, Control Plane API
│   └── worker/            # Node.js, BullMQ, OmniRoute AI logic, Webhooks
├── packages/
│   ├── database/          # Prisma schema, migrations, client
│   ├── config/            # Shared ESLint, TSConfig
│   └── types/             # Shared TypeScript interfaces
├── docs/                  # Architecture & Requirements
└── package.json
```

## 2. Tech Stack Requirements Check
- **Node:** v20.x or higher (LTS).
- **Package Manager:** `pnpm` (Fast, strict, great for monorepos).
- **Next.js:** 15.x (App Router).
- **React:** 19.x.
- **UI:** Tailwind CSS v3/v4 + shadcn/ui framework.
- **Database:** Local Docker container running PostgreSQL 16+.
- **Cache/Queue:** Local Docker container running Redis stack.

## 3. Git & Branching Strategy
- `main` is protected and deployable at all times.
- Feature branches (`feat/omniroute-engine`, `fix/ui-button-alignment`) branch off `main`.
- PRs require passing CI (TypeScript compilation, ESLint, Prettier, basic tests).
- Conventional Commits enforced (`feat:`, `fix:`, `chore:`, `docs:`).

## 4. Environment Variables
- Ensure a `.env.example` exists.
- NEVER commit `.env` or any production secrets.
- Required variables: `DATABASE_URL`, `REDIS_URL`, `NEXTAuth_SECRET` (if using NextAuth/Auth.js), AI Provider API Keys.

## 5. Security & Practices
- **Input Validation:** Use `zod` for all incoming API validations (both Next.js Route Handlers and Worker ingestion).
- **Authentication:** JWT/Session based securely mapped to Tenant IDs.
- **Error Handling:** Centralized error handling wrapper for API routes to prevent stack trace leaks.

## 6. Testing Strategy
- **Unit Tests:** `Vitest` for OmniRoute algorithms and business logic.
- **Integration Tests:** Test Database + Prisma interactions.
- **E2E:** `Playwright` for critical dashboard paths (Login, Add Domain, View Analytics).