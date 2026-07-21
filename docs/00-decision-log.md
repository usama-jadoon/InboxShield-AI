# Architecture Decision Log (ADR)

## ADR 001: Separation of Control Plane and Data Plane
**Date:** 2026-07-21
**Status:** Accepted
**Context:** Serverless functions (Vercel) are excellent for dashboard UIs but fail structurally for high-volume webhook ingestion and SMTP pacing due to execution time limits and high compute costs.
**Decision:** We will split the architecture. Next.js on Vercel for UI/Mgmt (Control Plane), and containerized Node.js for webhook/queue processing (Data Plane).

## ADR 002: Prisma + Serverless Handling
**Date:** 2026-07-21
**Status:** Accepted
**Context:** Next.js serverless functions can spawn thousands of concurrent DB connections, bringing down PostgreSQL.
**Decision:** We will strictly require PgBouncer or Prisma Accelerate for all Control Plane DB interactions.

## ADR 003: Redis as the Backbone
**Date:** 2026-07-21
**Status:** Accepted
**Context:** Webhook POST responses back to ESPs must be <200ms or they penalize the endpoint.
**Decision:** All incoming webhooks immediately hit a Fastify endpoint that dumps the raw JSON onto a BullMQ Redis queue. The HTTP response is 200 OK immediately. A worker process reads the queue, parses, and writes to Postgres async.
