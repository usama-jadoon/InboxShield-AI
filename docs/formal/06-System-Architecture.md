# 06. System Architecture

## High-Level Topology
The system adheres to a strict separation of concerns to protect the high-volume ingestion pipeline from frontend latency.

### 1. Control Plane
- **Tech Stack:** Next.js 15, React 19, Vercel Serverless.
- **Role:** Handles human interactions. User auth, dashboard rendering, graph generation, configuration management.
- **Scaling:** Infinitely via Vercel Edge.
- **Database Access:** Direct to Postgres via Prisma using PgBouncer for connection pooling to prevent Vercel from exhausting DB connections.

### 2. Data Plane
- **Tech Stack:** Node.js (Worker), Fastify (API), BullMQ (Queueing).
- **Role:** Handles machine interactions. API inbound dispatch from clients, OmniRoute execution, Webhook ingestion, background domain scanning.
- **Scaling:** Containerized (Docker). Scales horizontally via AWS ECS or Render based strictly on Redis queue depth metrics.

### 3. Artificial Intelligence Layer
- **Tech Stack:** `omni.route.ts` bridging OpenAI/Anthropic APIs for payload checking, combined with local deterministic heuristic matching.

## Data Flow Diagram
```text
[Client App] --> (POST /v1/send) -> [Fastify Dispatch Gateway]
                                          |
                                    [OmniRoute AI] <--> [Redis Reputation Cache]
                                          |
[Fastify Dispatch Gateway] ---> HTTP POST to [AWS SES / SendGrid]

... later ...

[AWS SES Webhook] --> (POST /v1/webhooks/ses) -> [Fastify Webhook Ingress]
                                                        |
                                                  [BullMQ / Redis]
                                                        |
                                                 [Node.js Worker]
                                                        |
                                       [Update Redis Cache & PostgreSQL DB]
```
