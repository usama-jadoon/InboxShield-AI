# System Architecture Document

**Product Name:** InboxShield AI  
**Document Status:** Approved Draft  
**Role View:** Principal Software Architect  

---

## 1. Architectural Philosophy
InboxShield AI is engineered across a strict **Control Plane / Data Plane** dichotomy. 
- The **Control Plane** handles user interaction, configurations, and aggregated reporting. It is optimized for static delivery and standard CRUD operations.
- The **Data Plane** handles the high-throughput, low-latency execution of email sending, AI routing logic, and webhook ingestion. It is optimized for resilience, continuous connections, and asynchronous processing.

---

## 2. Folder Structure (Monorepo)
The application utilizes a monorepo architecture to share types, configurations, and the database schema while explicitly decoupling the frontend from heavy backend processes.

```text
/inboxshield-ai
├── apps/
│   ├── web-app/               # Control Plane: Next.js 15 (React 19, Tailwind)
│   └── worker-node/           # Data Plane: Node.js (Fastify/Express + BullMQ)
├── packages/
│   ├── db-prisma/             # Shared Prisma schema, clients, and migrations
│   ├── core-types/            # Shared TypeScript interfaces & DTOs
│   ├── ai-routing/            # Shared OmniRoute evaluation logic
│   └── config/                # Shared ESLint, Prettier, TSConfig
├── docs/                      # PRDs, Architecture, and API Docs
└── infra/                     # Dockerfiles, Terraform/Pulumi scripts
```

---

## 3. Logical Modules

### Control Plane Modules (Next.js)
1. **Tenant Management Module:** Workspace isolation, User RBAC, and billing integration.
2. **Configuration Module:** Managing assigned ESPs (API keys), Domain settings, and routing weight rules.
3. **Analytics Module:** Aggregation queries on PostgreSQL to display health scores, placement metrics, and log queries.

### Data Plane Modules (Node.js Worker)
1. **Dispatch Gateway:** High-performance REST/SMTP receiver that accepts outbound email payloads.
2. **OmniRoute Service:** Executes the AI decision logic.
3. **Webhook Ingestion Module:** Standardized endpoints for SES, SendGrid, and Mailgun to receive event callbacks.
4. **Scanner Engine:** Scheduled monitoring systems.

---

## 4. Service Layer Pattern
Both the Next.js API routes and the Node.js workers strictly adhere to a **Controller-Service-Repository** pattern to ensure business logic is isolated from transport layers (HTTP/WebSockets).
- **Controllers / Route Handlers:** Handle HTTP request validation (via Zod), auth extraction, and response formatting.
- **Service Layer:** Contains core business logic (e.g., `EmailDispatchService`, `TenantProvisioningService`). This abstracts the "how."
- **Repository / DAL (Data Access Layer):** Wraps Prisma calls. Abstracting DB queries prevents vendor lock-in and allows for easy mocking during unit tests.

---

## 5. AI Layer (OmniRoute Engine)
The OmniRoute engine predicts the best delivery path (ESP) per email.
- **Phase 1 (Heuristic + Local AI):** A lightning-fast scoring algorithm executing in `<50ms`. It evaluates the recipient's ISP (Google, Outlook, Yahoo) against an in-memory Redis cache of the Tenant's recent ESP performance.
- **Phase 2 (LLM Payload Evaluation):** An asynchronous pipeline evaluating email copy for "spammy" characteristics via OpenAI/Anthropic APIs, flagging suspicious campaigns *before* dispatch.
- **Failover:** If the AI layer times out (>100ms) or an ESP goes offline, OmniRoute invokes a hardcoded fallback circuit (Standard Round Robin).

---

## 6. Scanner Engine
A dedicated micro-process operating within the Data Plane responsible for infrastructure health.
- **DNS compliance:** Periodically queries DNS records via `dns` module for SPF, DKIM, and DMARC integrity.
- **Blacklist (RBL) Checks:** Cross-references assigned tenant IPs and domains against major Real-time Blackhole Lists (Spamhaus, Barracuda).
- **Triggers:** If a failure is detected, the Scanner notifies the OmniRoute engine to instantly deprecate the affected IP/ESP's routing score, preventing damaged sender reputation.

---

## 7. API Flow (Request Lifecycle)
**Outbound Email Flow:**
1. Client makes `POST /v1/send` to the Data Plane.
2. API Key is intercepted, verified via Redis cache (sub-millisecond auth).
3. Payload validated (Zod).
4. Passed to OmniRoute AI Layer; optimal ESP selected based on reputation matrix.
5. Payload mapped to the selected ESP API contract.
6. HTTP request dispatched to the ESP.
7. Return `202 Accepted` to client. Background event pushes the `Attempt` log to PostgreSQL.

**Inbound Webhook Flow:**
1. Incoming POST from ESP hits Webhook Ingestion URL.
2. Immediate 200 OK returned to ESP to satisfy their delivery requirements.
3. Payload drops onto a BullMQ Redis Queue.
4. Worker picks up the job, normalizes the payload into standard `EmailLog` format, updates the local AI Reputation Cache, and persists to PostgreSQL.

---

## 8. Database Architecture
- **Primary Datastore:** PostgreSQL.
- **Schema Design:** Heavily relational for Tenants, Domains, and ESP Configurations. Highly partitioned for Telemetry/Logs.
- **Connection Pooling:** Utilizing PgBouncer or Prisma Accelerate to ensure standard serverless DB connection limits are not exhausted by the Next.js frontend or Node.js workers.

---

## 9. Caching Strategy
Redis acts as the nervous system of the Data Plane.
- **Rate-Limiting:** Token bucket algorithm on API endpoints.
- **AI Reputation Matrix:** Warm cache containing the last 24h health score of every Tenant-ESP-ISP combination.
- **Auth Cache:** Hashed API keys cached for 5 minutes to prevent hitting PostgreSQL on every outbound dispatch.

---

## 10. Background Jobs
Managed via **BullMQ** running on top of Redis within the Node.js Data Plane tier.
- **Queueing Topology:**
  - `webhook-ingestion`: High priority, high throughput.
  - `log-compaction`: Low priority, rolling up raw logs into daily aggregate statistics.
  - `scanner-tasks`: Medium priority, periodic domain health checks.
  - `warmup-engine`: Paced dispatch of artificial warmup emails to build IP reputation.

---

## 11. Authentication & Security
- **Human Auth (Dashboard):** NextAuth.js configured with secure JWTs, utilizing standard OAuth/Credentials providers. Tied to Role-Based Access Control (RBAC) via the database.
- **Machine Auth (API Keys):** Clients use Tenant-scoped API keys passed via `Authorization: Bearer <key>`. Keys are generated via crypto RNG, hashed (SHA-256) inside PostgreSQL, and stored highly cached in Redis.

---

## 12. Error Handling & Resilience
- **Circuit Breakers:** Implemented against external ESP APIs. If AWS SES throws >5% 5xx errors within a minute, the circuit "opens" and OmniRoute automatically shifts 100% of traffic to alternate ESPs for a designated timeout period.
- **Dead Letter Queues (DLQ):** Webhooks or log ingestions that fail to process >3 times are shelved into a DLQ for manual developer introspection, preventing poison pill payloads from crashing the workers.
- **Idempotency:** All webhook ingestions require evaluating the provider's unique `MessageID` to drop duplicate callbacks.

---

## 13. Scalability & Deployment
- **Control Plane (Next.js):** Deployed to Vercel (Edge/Serverless). Auto-scales infinitely based on web traffic. Global asset distribution.
- **Data Plane (Node.js + BullMQ):** Deployed via Docker containers to AWS ECS, Kubernetes, or Render. These must run on persistent compute instances allowing for rapid horizontal scaling of Node containers tied to a central Redis instance based on Queue Depth metrics.
- **Database:** Managed PostgreSQL (e.g., AWS RDS, Supabase, Neon) configured with automatic storage auto-scaling and read-replicas when aggregate dashboard queries begin to impact write throughput.