# InboxShield AI

InboxShield AI is an automated domain authentication and reputation monitoring platform. It is a monorepo built using Turbo, Next.js, and TypeScript.

## Product Overview
InboxShield AI actively scans and analyzes domain DNS records (SPF, DKIM, DMARC, MX) and reputation signals, generating actionable remediation reports and insights to ensure high email deliverability.

## Features
- Scalable Worker Queue (BullMQ, Redis) for webhook ingestion and task processing
- Intelligent Scanning Engine checking configuration records (MX, SPF, DMARC, DNSSEC, etc.)
- Web Dashboard natively built with Next.js App Router for analytics and reporting
- Persistent Scan History via Prisma ORM and PostgreSQL
- Automated Release Readiness Reports

## Architecture 
The workspace is managed by Turborepo holding multiple packages:
- `apps/web`: Next.js 16 control plane dashboard
- `apps/worker`: Fastify/BullMQ daemon processing webhooks and performing background DNS scanning
- `packages/engine`: Core logic controlling the domain scanning orchestration
- `packages/db`: Prisma database mappings for global repository access

## Tech Stack
- Frontend: Next.js (React), TailwindCSS V4, Shadcn UI
- Backend: Node.js, Fastify, BullMQ
- Database/Cache: PostgreSQL (via Prisma), Redis (via ioredis)
- Build System: Turborepo, TypeScript

## Environment Setup
Required `.env` variables include:
- `DATABASE_URL`: PostgreSQL connection string (defaults generally expect standard pg URL formats for Prisma)
- `REDIS_URL`: Connection string for BullMQ inside `apps/worker` (defaults to `redis://localhost:6379`)

Please create a `.env` in the root (which is git-ignored) before you start.

## Installation Steps
Ensure you are using at least Node.js 20.0.0.

```bash
git clone <repository-url>
cd <repository-directory>
npm install
```

## Development Commands
- `npm run dev`: Runs all development servers (Web & Worker) using turborepo
- `npm run build`: Generates production builds using turbo
- `npm run lint`: Checks for linting errors across packages
- `npm run test`: Test execution suite
- `turbo run typecheck`: Validating TS types (if implemented at package level)

## Roadmap
- Integrate proper implementations for DnssecScanner and WhoisScanner using third party APIs
- Complete export pipeline generation (PDF / CSV) from ReportGenerator
- Full automation testing suite and CI/CD pipelines
