# 15. Decision Log (ADR)

*An immutable history of architectural direction.*

## ADR-001: Separation of Control Plane and Data Plane
**Date:** 2026-07-21
**Context:** Vercel edge/serverless functions are phenomenal for rapidly fetching data for a UI, but structurally incompatible with handling continuous, high-volume webhook dumps or long-running SMTP pacing tasks due to hard execution timeouts.
**Decision:** Total architectural split. Next.js handles humans (UI/Config) via Vercel. A persistent Node.js/Fastify instance handles machines (Webhooks/Queues/Dispatch) via AWS ECS/Docker.

## ADR-002: PostgreSQL over NoSQL
**Date:** 2026-07-21
**Context:** Email logs eventually scale to billions of rows. Systems like MongoDB promise scale, but Tenant configurations require deep relational integrity, foreign key constraints, and cascading rules.
**Decision:** Use PostgreSQL. The core data remains perfectly relational. The telemetry logs (`EmailMessage`, `EmailEvent`) will utilize Declarative Table Partitioning (by Month) to scale logs into the millions without choking index write-speeds.

## ADR-003: Redis as the Nerve Center
**Date:** 2026-07-21
**Context:** Pinging PostgreSQL synchronously before every outbound dispatch to gather the AI Health Score adds massive latency.
**Decision:** Adopt Redis. Fastify API utilizes Redis for instantaneous API Key lookup, Rate-limiting Token Buckets, and an `OmniRoute Reputation Matrix` which holds memory-cached 24-hour health scores for lightning-fast routing selections.
