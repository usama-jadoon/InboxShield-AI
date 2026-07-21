# 12. Deployment Strategy

## Architecture Split Execution
Because Serverless environments penalize long-running background tasks, deployment targets are permanently decoupled.

### 1. Control Plane (WebApp & Mgmt APIs)
- **Target:** Vercel
- **Repo Coupling:** Deploys `apps/web` automatically on push to `main`.
- **Reasoning:** Zero-config edge caching, instant rollbacks, perfect CI/CD for React.

### 2. Data Plane (Ingress & Background Workers)
- **Target:** AWS ECS (Fargate) via Docker, or Render.com (Background Worker tier).
- **Repo Coupling:** Builds `apps/worker` via a `Dockerfile`.
- **Reasoning:** Fastify and BullMQ require persistent, long-running Node.js processes. Running queue pollers inside Vercel Serverless forces immediate execution timeouts and massive billing spikes. Constant containerized compute ensures predictable costs regardless of thousands of webhooks streaming concurrently.

## Infrastructure Dependencies
- **Database:** Fully managed PostgreSQL (e.g., Supabase or AWS RDS). MUST use a connection pooler (`PgBouncer`) due to Vercel's serverless connection spikes.
- **Cache/Queue:** Upstash Redis or AWS Elasticache. BullMQ logic executes heavily here.

## Deployment Pipeline (GitHub Actions)
1. Commit to `main`.
2. Action runs `pnpm test` and `pnpm lint`. (Pipeline aborts on failure).
3. Action executes Prisma Migrations against shadow DB schema to ensure data safety.
4. If successful, Vercel pulls and deploys `apps/web`.
5. Simultaneously, Action builds `worker.Dockerfile`, pushes image to Registry, and triggers AWS/Render to perform a zero-downtime rolling restart.
