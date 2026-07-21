# Deployment Strategy

**Product Name:** InboxShield AI

To separate concerns and optimize billing, the platform uses a hybrid deployment model.

## 1. Control Plane (WebApp & API)
- **Host:** Vercel
- **Technology:** Next.js Serverless Edge / Node functions.
- **Why:** Auto-scales UI traffic instantly, edge caching for static assets, out-of-the-box CI/CD integration with GitHub.

## 2. Data Plane (Dispatch & Ingest Workers)
- **Host:** AWS ECS (Fargate) or Render.com Background Workers.
- **Technology:** Dockerized Node.js (Fastify + BullMQ).
- **Why:** Serverless environments charge heavily per millisecond execution. High-volume, continuous queue polling is drastically cheaper and more predictable on persistent containers.

## 3. Persistent Infrastructure
- **Relational Database:** AWS RDS PostgreSQL or Supabase. Must support connection pooling (PgBouncer) natively to handle Vercel's serverless connection spikes.
- **Cache/Queue:** Redis (Upstash for Serverless compat, or AWS ElastiCache for the Data Plane).
- **DNS management:** Route53 or Cloudflare for programmatic domain verification testing.

## 4. Continuous Integration / Continuous Deployment
- **Git Provider:** GitHub.
- **CI Pipeline:** GitHub Actions.
  - On Push to main: Run tests, build Docker images, push to GHCR (GitHub Container Registry).
  - Vercel auto-deploys the Control Plane.
  - Data Plane deployment triggered via webhook to AWS ECS/Render to pull the newest image and perform a rolling restart (zero-downtime).