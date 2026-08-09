# InboxShield AI — Canonical Technical Architecture

**Version:** 1.0 (Canonical)
**Date:** 2026-08-08
**Status:** Baseline — all future architecture decisions reference this document
**Authority:** Second only to executable repository source code; supersedes `docs/formal/06-System-Architecture.md`

---

## 1. System Context

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         InboxShield AI Platform                         │
│                                                                          │
│  ┌─────────────────────┐    ┌──────────────────────────────────────┐    │
│  │    apps/web          │    │         apps/worker                  │    │
│  │  Next.js 16 Control  │    │    Fastify + BullMQ Data Plane       │    │
│  │      Plane           │    │                                      │    │
│  │  - Dashboard UI      │    │  - Webhook ingestion (ESP events)    │    │
│  │  - Domain CRUD       │    │  - Background scan execution         │    │
│  │  - Scan triggering   │    │  - Event normalization               │    │
│  │  - Report viewing    │    │  - DB writes                         │    │
│  │  - Export (PDF/CSV)  │    │                                      │    │
│  └────────┬─────────────┘    └──────────┬───────────────────────────┘    │
│           │                             │                                │
│           └──────────┬──────────────────┘                                │
│                      │                                                    │
│            ┌─────────▼──────────┐                                        │
│            │  @inboxshield/db   │                                        │
│            │  Prisma/PostgreSQL  │                                        │
│            └─────────┬──────────┘                                        │
│                      │                                                    │
│            ┌─────────▼──────────┐                                        │
│            │ @inboxshield/engine │ ← deterministic scanners, scoring,     │
│            │  (persistence-     │   evidence/report models, orchestration │
│            │   agnostic)        │                                        │
│            └────────────────────┘                                        │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
         │                                  │
         ▼                                  ▼
┌─────────────────────┐         ┌──────────────────────┐
│    PostgreSQL        │         │       Redis           │
│  Product data store  │         │  BullMQ queue + cache │
└─────────────────────┘         └──────────────────────┘
                                         │
                                         ▼
                                ┌──────────────────────┐
                                │  ESP Webhooks         │
                                │  (SendGrid, SES, etc) │
                                └──────────────────────┘

Future (not yet integrated):

┌──────────────────────────────────────────────────────┐
│  ASC-Orchestrator v1.0.0 (separate Python project)    │
│  High-level mission orchestration (evidence-gated)    │
│  Referenced by scan/evidence IDs — never duplicates   │
│  data from InboxShield                                │
└──────────────────────────────────────────────────────┘
```

---

## 2. Applications and Packages

### 2.1 Monorepo Structure

| Package | NPM name | Purpose | Status |
|---|---|---|---|
| `apps/web` | `web` | Next.js 16 control plane | Working (stub UI + broken API) |
| `apps/worker` | `worker` | Fastify + BullMQ data plane | Working (stub processor, real Fastify) |
| `packages/engine` | `@inboxshield/engine` | Deterministic scanner library | Working (7 scanners, orchestrator, scoring, report) |
| `packages/db` | `@inboxshield/db` | Prisma persistence layer | Broken (package export dead; schema valid) |
| `packages/types` | `@inboxshield/types` | Shared TypeScript interfaces | Working (EmailPayload, NormalizedWebhookEvent) |
| `packages/typescript-config` | `@inboxshield/typescript-config` | Shared tsconfig.json | Working |
| `packages/eslint-config` | `@inboxshield/eslint-config` | Shared ESLint config | Working (no code, config only) |

### 2.2 Dependency Graph

```
apps/web ──→ @inboxshield/engine  (scanners, orchestrator, report builder, AI provider)
         ──→ @inboxshield/db      (PrismaClient — currently not wired at runtime)

apps/worker ──→ @inboxshield/db      (PrismaClient — currently not wired at runtime)
            ──→ @inboxshield/types   (EmailPayload, NormalizedWebhookEvent)
            ──→ bullmq, fastify, ioredis

@inboxshield/db ──→ @prisma/client

@inboxshield/engine ──→ (zero runtime dependencies)

@inboxshield/types ──→ (zero runtime dependencies)
```

**Invariant:** `packages/engine` has zero runtime dependencies. It never imports `packages/db`, `apps/web`, `apps/worker`, `next`, `fastify`, or `react`. It is a pure TypeScript library.

**Invariant:** `packages/db` may `import type` from `packages/engine` (for `ReportModel` type) but never at runtime. `packages/engine` never imports `packages/db`. No cycles.

### 2.3 Build System

- **Turborepo** orchestrates workspace builds, lint, dev
- `turbo.json` defines: `build` (dependsOn `^build`), `lint`, `dev` — no `test` or `typecheck` tasks exist yet
- Each workspace builds independently via `tsc` (engine, db, worker) or `next build` (web)
- `npm run test` at root calls `turbo run test` — resolves to no-op (no workspace defines a `test` script)

---

## 3. Runtime Boundaries

### 3.1 Control Plane vs Execution Plane

| Plane | Application | Responsibilities |
|---|---|---|
| **Control Plane** | `apps/web` | User-facing UI, API routes for scan triggering, auth, report viewing, export |
| **Execution Plane** | `apps/worker` | Background job execution, webhook ingestion, ESP event processing, scheduled scans |

The control plane **requests** work; the execution plane **performs** work. They communicate through PostgreSQL (shared data) and BullMQ/Redis (job queue).

### 3.2 Package Boundary Rules

| Package | Owns | Must NOT own |
|---|---|---|
| `packages/engine` | Scanner contracts, deterministic execution, evidence/report models, scoring/rules, orchestration | PrismaClient, PostgreSQL, DB CRUD, persistence, HTTP, React, Next.js |
| `packages/db` | Prisma schema, migrations, DB queries, persistence services | Scanner logic, scoring logic, UI, HTTP handling |
| `apps/web` | UI rendering, API route handlers, auth, user interaction | Scanner execution, DB schema design, queue processing |
| `apps/worker` | Job execution, webhook processing, ESP normalization, background scans | UI, auth, user interaction, schema design |

---

## 4. Canonical Scanner Architecture

### 4.1 Engine Scanner Contract (`packages/engine`)

```
BaseScanner
  ├── id: string          (e.g., 'auth:spf')
  ├── description: string
  └── execute(domain) → ScannerResult
        ├── scannerId: string
        ├── passed: boolean | null (true ONLY for PASS, false ONLY for FAIL, null when no definitive verdict)
        ├── scoreWeight: number  (0-100, penalty when !passed)
        ├── rawData: unknown     (raw DNS data, cert info, etc.)
        ├── error?: string
        └── flags: string[]      (e.g., 'MISSING_SPF', 'WEAK_TLS')

EngineOrchestrator
  ├── registerScanner(BaseScanner)
  └── analyzeDomain(domain) → EngineReport
        ├── domain: string
        ├── timestamp: string
        ├── globalScore: number  (100 - Σweights of failed scanners)
        ├── riskLevel: LOW | MEDIUM | HIGH | CRITICAL
        └── scannerResults: Record<string, ScannerResult>
```

### 4.2 Engine Scanners (7)

| Scanner ID | Class | What it checks | DNS / Network method |
|---|---|---|---|
| `network:dns:a_record` | `DnsScanner` | A/AAAA record existence | DoH (Cloudflare) |
| `auth:spf` | `SpfScanner` | SPF record validity | DoH (Cloudflare) |
| `auth:dkim` | `DkimScanner` | DKIM record at selector | DoH (Cloudflare) |
| `auth:dmarc` | `DmarcScanner` | DMARC policy enforcement | DoH (Cloudflare) |
| `network:mx` | `MxScanner` | MX record existence | DoH (Cloudflare) |
| `network:smtp:tls` | `TlsScanner` | SMTP STARTTLS + TLS cert on primary MX | `node:dns/promises` (MX resolution) + `node:net` + `node:tls` (TCP :25) |
| `network:blacklist:domain` | `BlacklistScanner` | DBL listing (Spamhaus) | `node:dns/promises` (A record against dbl.spamhaus.org, multi.surbl.org) |

### 4.3 Worker Scanners (10, using `node:dns`)

| Scanner | What it checks | Engine equivalent | Status |
|---|---|---|---|
| `DnsScanner` | A records + TXT records | `DnsScanner` (DoH) | Duplicate — will be deprecated |
| `SpfScanner` | SPF TXT record | `SpfScanner` (DoH) | Duplicate — will be deprecated |
| `DkimScanner` | DKIM TXT at selector | `DkimScanner` (DoH) | Duplicate — will be deprecated |
| `DmarcScanner` | DMARC TXT at `_dmarc.` | `DmarcScanner` (DoH) | Duplicate — will be deprecated |
| `MxScanner` | MX records | `MxScanner` (DoH) | Duplicate — will be deprecated |
| `TlsScanner` | TLS cert on :443 (HTTPS) | `TlsScanner` (TCP :25 SMTP STARTTLS) | Different scope — worker checks HTTPS certs, engine does SMTP STARTTLS |
| `BlacklistScanner` | IP RBL + domain DBL | `BlacklistScanner` (DBL only) | **IP-RBL migrates to engine** (P0-06) |
| `SmtpScanner` | TCP :25 reachability | — | **PARTIAL** — no engine equivalent yet |
| `DnssecScanner` | DNSSEC validation | — | **STUB** — always returns `passed: true` |
| `WhoisScanner` | Domain age | — | **STUB** — always returns `ageDays: 365` |

### 4.4 Scanner Unification (V1 target)

Worker scanners are compared, then deprecated in favor of engine scanners. Worker's `IP-RBL` logic migrates into the engine as a new `BaseScanner`. The worker calls engine scanners via `EngineOrchestrator` instead of running its own independent scanners.

---

## 5. Database Ownership

### 5.1 Current Schema (PostgreSQL via Prisma)

```
Workspace (id, name, createdAt, updatedAt)
  └── has many → Domain (id, domainName [unique], workspaceId, createdAt, updatedAt)
        └── has many → ScanReport (id, domainId, score, riskLevel, reportModel [Json], createdAt)
```

- `ScanReport.reportModel` stores the full `ReportModel` JSON — this is the immutable evidence snapshot
- Indexes: `[domainId, createdAt DESC]` and `[createdAt DESC]`
- No migration files exist yet (P0-03 generates the initial migration)

### 5.2 Ownership Rules

| Data | Writer | Reader | Store |
|---|---|---|---|
| Workspaces | Web (signup) | Web | PostgreSQL |
| Domains | Web (user adds) | Web, Worker | PostgreSQL |
| Scan results | Worker (scan execution) | Web (display/export) | PostgreSQL (`ScanReport`) |
| Scanner evidence | Engine (scanner output) | Web (display), Worker (processing) | Inside `ScanReport.reportModel` |
| ESP events | Worker (webhook normalization) | Web (delivery health display) | PostgreSQL (future) |

### 5.3 Immutable Evidence Principle

A `ScanReport` row, once created, represents an immutable point-in-time evidence snapshot:
- `reportModel` is the serialized `ReportModel` JSON
- `score` and `riskLevel` are derived values frozen at scan time
- Historical comparison requires two `ScanReport` rows for the same domain at different timestamps
- The `ReportModel.metadata.version` field tracks the evidence contract version

---

## 6. Worker Architecture

### 6.1 Current State

```
Fastify (port 3001)
  ├── GET  /health              → { status: 'ok', timestamp }
  └── POST /v1/webhooks/:esp    → enqueue to BullMQ → return { received: true }

BullMQ (webhook-ingestion queue)
  └── webhookWorker: log + sleep(50ms)  ← STUB, no real processing

Worker scanners (10 independent classes)
  └── ScoringEngine.evaluateDomain()  ← NOT wired to any caller
  └── OmniRouteAI  ← stub
  └── ReportGenerator  ← stub (fake CSV/PDF)
```

### 6.2 Target State (V1)

```
Fastify (port 3001)
  ├── GET  /health              → { status, db, redis }
  ├── POST /v1/webhooks/:esp    → enqueue to BullMQ
  └── POST /v1/scans            → enqueue scan job

BullMQ (two queues)
  ├── webhook-ingestion         → normalize ESP events → write EmailEvent to DB
  └── scan-jobs                 → call @inboxshield/engine → write ScanReport to DB

Worker scanners → REPLACED by engine orchestrator calls
OmniRouteAI → LLM-backed AiProvider (or heuristic fallback)
ReportGenerator → REPLACED by real PDF/CSV export routes
```

---

## 7. BullMQ / Redis Responsibilities

### 7.1 Current State

- **Redis connection:** `redis://localhost:6379` (or `REDIS_URL` env var)
- **Queue:** `webhook-ingestion` — 3 attempts, exponential backoff (1s base), concurrency 50
- **Worker:** BullMQ `Worker` processes jobs — currently logs + sleeps 50ms
- **QueueEvents:** available for job lifecycle monitoring

### 7.2 Target State

| Queue | Purpose | Processor |
|---|---|---|
| `webhook-ingestion` | ESP webhook events | Normalize → DB write (EmailEvent) |
| `scan-jobs` | Domain scan requests | Engine orchestrator → DB write (ScanReport) |
| `scheduled-scans` | Periodic re-scans | BullMQ repeatable jobs, configurable per domain |

Redis also serves as:
- BullMQ job state and retry data
- Session store (future: NextAuth adapter)
- Rate limiting backend (future: `RedisRateLimiter`)

---

## 8. Evidence Flow

```
1. User triggers scan (web: POST /api/scan)
   ↓
2. Web enqueues scan job (BullMQ → scan-jobs queue)
   ↓
3. Worker picks up job → creates EngineOrchestrator
   ↓
4. Orchestrator runs all scanners concurrently (safeExecute wraps each)
   ↓
5. Each scanner produces ScannerResult (passed, scoreWeight, rawData, flags)
   ↓
6. Orchestrator computes EngineReport (globalScore, riskLevel)
   ↓
7. HeuristicAiProvider.analyze(EngineReport) → AiRecommendation[]
   ↓
8. ReportBuilder.build(EngineReport, recommendations) → ReportModel (v1.0.0)
   ↓
9. Worker persists ScanReport to DB:
   { domainId, score: globalScore, riskLevel, reportModel: <ReportModel JSON> }
   ↓
10. Web reads ScanReport from DB → displays to user
```

**Critical invariant:** Steps 4-8 are deterministic. The same domain scanned at the same time produces the same `EngineReport` and `ReportModel`. Step 9 freezes the snapshot. Step 10 reads the frozen snapshot — never re-runs scanners for display.

---

## 9. AI Boundary

### 9.1 Engine AI (HeuristicAiProvider)

- **Deterministic:** maps scanner flags to `AiRecommendation[]` — no external API calls, no randomness
- **Interface:** `AiProvider.analyze(report) → AiRecommendation[]`
- **Rules:** recommendations must be grounded in scanner findings; never fabricate issues not present in the `EngineReport`

### 9.2 Worker AI (OmniRouteAI)

- **Current:** keyword-based heuristics (crypto, ALL CAPS, "click here" → spam score)
- **Future:** replace with LLM-backed `AiProvider` implementation
- **Boundary:** even with LLM integration, AI must never override scanner pass/fail determinations

### 9.3 AI Anti-Fabrication Rules

| AI must NEVER | Reason |
|---|---|
| Invent scanner facts | Scanner results are deterministic ground truth |
| Override a scanner's `passed: true/false` | That would corrupt the evidence chain |
| Fabricate DNS, authentication, or reputation status | That would produce false positives/negatives |
| Claim a check was performed when it was not | Must use `UNSUPPORTED`/`NOT_IMPLEMENTED` status |
| Present `UNSUPPORTED` as `PASS` or `FAIL` | `NOT CHECKED ≠ FAILED`; `UNSUPPORTED ≠ PASS` |

---

## 10. ASC-Orchestrator Future Boundary

ASC-Orchestrator v1.0.0 is a **separate, already-released Python project**.

```
┌──────────────────────────────────────────────────────────────┐
│ InboxShield AI  (TypeScript monorepo)                        │
│  Scanner execution · Evidence collection · Scoring · Reports  │
│  PostgreSQL product data (source of truth)                   │
└──────────────────────────┬───────────────────────────────────┘
                           │  (future HTTP seam)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│ ASC-Orchestrator v1.0.0  (separate Python project)           │
│  Mission lifecycle · Evidence-gated progression               │
│  Remediation workflows · Risk gates · Escalation              │
│  References InboxShield evidence by scan/evidence IDs only    │
└──────────────────────────────────────────────────────────────┘
```

**Hard rules:**
- ASC must NOT be copied, vendored, or forked into this monorepo
- ASC must NOT replace BullMQ
- ASC must NOT perform scans or determine pass/fail
- ASC must NOT own factual deliverability truth
- ASC references InboxShield scan/evidence IDs — never duplicates scanner data
- See `docs/ASC_INTEGRATION_PLAN.md` for full boundary definition

---

## 11. Failure Boundaries

| Failure | Containment | Impact |
|---|---|---|
| Single scanner throws | `safeExecute` catches → returns `ScannerResult` with `passed: null` + `SCANNER_FAULT` flag | One scanner result is `passed: null` (ERROR — no verdict) with `scoreWeight: 0`; other scanners continue |
| Orchestrator crashes | `POST /api/scan` catches → 500 response (generic message) | Single scan request fails; no data loss |
| Database unavailable | API returns 500; worker jobs fail and retry (BullMQ backoff) | Scans queue up; retries handle transient DB outages |
| Redis unavailable | BullMQ jobs cannot be enqueued or processed | Webhook ingestion stalls; Fastify still serves `/health` |
| ESP webhook malformed | Worker job fails → BullMQ retries (3 attempts, exponential backoff) | After 3 failures, job moves to failed state (1000 retained for inspection) |
| Individual scanner DNS timeout | Scanner returns `passed: null, error: "timeout"` (ERROR — no verdict) | No score penalty; no crash |

---

## 12. Security Boundaries

| Boundary | Current | Target (V1) |
|---|---|---|
| Auth | Hardcoded credentials in NextAuth | OAuth (Google/GitHub) + JWT sessions |
| Route protection | None — all routes open | `middleware.ts` gates authenticated routes |
| API auth | None on `/api/scan` | Session-checked; rate-limited per workspace |
| Rate limiting | None | `RateLimiter` interface; dev: `LocalMemoryRateLimiter`; prod: `RedisRateLimiter` |
| SSRF | None | Resolve A records, block RFC1918/loopback/link-local on scan targets |
| Domain validation | Empty check only | RFC-compliant hostname regex, max 253 chars |
| Error leakage | `error.message` returned on 500 | Generic error messages only; `error.message` never leaked |
| Secrets | Compliant (env vars) | Compliant (env vars) |

---

## 13. Deployment Topology

### 13.1 Current (Local Development)

```
localhost:3000     → apps/web (Next.js dev server)
localhost:3001     → apps/worker (Fastify server)
localhost:5432     → PostgreSQL (inboxshield database)
localhost:6379     → Redis
```

No Docker Compose exists yet. Services are started manually.

### 13.2 Current (CI)

No CI pipeline exists. No `.github/workflows/` directory.

### 13.3 Target (V1)

```
┌─────────────────────────────────────────────────┐
│  Container: web (Next.js)                        │
│  - Serves UI + API routes                        │
│  - Connects to PostgreSQL + Redis                │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  Container: worker (Fastify + BullMQ)            │
│  - Processes webhooks + scans                    │
│  - Connects to PostgreSQL + Redis                │
└─────────────────────────────────────────────────┘
┌──────────────────┐  ┌──────────────────┐
│  PostgreSQL       │  │  Redis            │
│  (managed or      │  │  (managed or      │
│   containerized)  │  │   containerized)  │
└──────────────────┘  └──────────────────┘
```

### 13.4 Future (SaaS Multi-Tenant)

- Per-workspace isolation at the data layer (workspaceId scoping on all queries)
- Per-workspace rate limiting
- Background scan scheduling per workspace
- Client portal (white-labeled) for agency model

---

## 14. Local Development Topology

```
Terminal 1:  cd apps/web && npm run dev         → localhost:3000
Terminal 2:  cd apps/worker && npm run dev      → localhost:3001
Terminal 3:  PostgreSQL running                  → localhost:5432
Terminal 4:  Redis running                      → localhost:6379
```

No unified `docker-compose.yml` exists yet (deferred).

---

*This is the canonical technical architecture document. It supersedes `docs/formal/06-System-Architecture.md` for all authoritative claims. Last verified against repository source: 2026-08-08.*
