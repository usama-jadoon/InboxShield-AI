# InboxShield AI — SaaS Gap Analysis

**Date:** 2026-08-08
**Type:** Gap analysis between current state and a minimum-viable SaaS product
**Baseline:** branch `audit/inboxshield-saas-baseline`, HEAD `17cd585`
**Scope:** Read-only. No features added, no architecture built.

> This document answers: "If InboxShield AI is to become a multi-tenant SaaS platform, what is missing, what order do things go in, and what depends on what?" All gaps are derived from comparing the current state (see `CURRENT_STATE_AUDIT.md`) against what a minimal SaaS product in this domain requires. Nothing here advocates adding speculative features.

---

## 1. Target Product Architecture (what a minimum-viable SaaS requires)

The target is the smallest viable SaaS that matches the existing docs/formal/06 vision: a **multi-tenant email deliverability platform** where users connect domains, schedule scans, receive results, and can act on recommendations.

The minimum set of runtime paths in the target:

```
User (browser)
  ↓ auth (login / session)
  ↓ dashboard (live data from DB)
  ↓ /domains → CRUD (create domain, see list)
  ↓ /domains/[domain] → live scan trigger + history
  ↓ /api/scan (authenticated, rate-limited, writes result to DB)
  ↓ PDF/CSV export (authenticated, reads from DB)

Worker (background)
  ↓ BullMQ webhook worker (normalized ingest, DB write)
  ↓ scheduled scan trigger (periodic re-scan)
  ↓ notification delivery (email/webhook on status change)
```

Minimum required services:
- **PostgreSQL** — workspace, domain, scan result persistence
- **Redis** — BullMQ queue + session store (NextAuth adapter)
- **Auth** — NextAuth v4 with a real provider (Google/GitHub OAuth or credentials + email verification)
- **Background worker** — BullMQ processor that actually does work
- **Scanner engine** — `@inboxshield/engine` (already exists, needs wiring)
- **PDF rendering** — `@react-pdf/renderer` (already installed in web, unused)
- **Monitoring** — at minimum, structured logging + health checks

---

## 2. Gap Matrix

Each row identifies one gap. The columns record what exists now, what the target needs, the severity, and whether the gap is blocking vs. deferred.

### 2.1 Persistence Layer

| # | Gap | Current State | Target State | Severity | Blocker? |
|---|---|---|---|---|---|
| P-1 | `@inboxshield/db` is not importable (`main: "index.ts"`, file doesn't exist) | Broken | Working package with `PrismaClient` export + singleton | 🔴 | **Yes** — nothing can use DB until this is fixed |
| P-2 | Prisma schema exists but has no migrations | `prisma validate` passes; `migrate` never run | Migrations in place; DB bootstrapped on startup | 🔴 | **Yes** — schema is theoretical |
| P-3 | Zero DB queries at runtime | All data is hardcoded or ephemeral | Every page reads from DB; scan writes to DB | 🔴 | **Yes** — core product gap |
| P-4 | HistoryService exists but is dead in `packages/db` nested tree | `packages/db/.../history.service.ts` has working Prisma calls | Canonical HistoryService in `packages/engine` or a new `packages/persistence` | 🟡 | Deferred to post-v1 wiring |
| P-5 | ScanReport schema has `reportModel Json` but no migration applying it | Schema only | Data present; seeded or migrated | 🟡 | Deferred |

### 2.2 Authentication & Authorization

| # | Gap | Current State | Target State | Severity | Blocker? |
|---|---|---|---|---|---|
| A-1 | Hardcoded credentials in NextAuth | `admin@inboxshield.ai` / `test` in source | Real auth provider (OAuth) or secure credential store | 🔴 | **Yes** — blocks any multi-user deployment |
| A-2 | No middleware.ts / route protection | All routes open | Middleware gates every authenticated route | 🔴 | **Yes** — blocks user isolation |
| A-3 | `/api/scan` has no auth | Open, unrate-limited | Session-checked; rate-limited per workspace | 🔴 | **Yes** — abuse surface |
| A-4 | No RBAC / workspace isolation | N/A | User→Workspace→Domain access checks | 🟡 | Deferred to multi-user phase |
| A-5 | No session store (DB-backed sessions) | JWT in memory only | NextAuth adapter for Redis or PostgreSQL | 🟡 | Deferred |

### 2.3 Scanner Infrastructure

| # | Gap | Current State | Target State | Severity | Blocker? |
|---|---|---|---|---|---|
| S-1 | Two incompatible scanner engines exist | `packages/engine` (7 scanners, DoH, orchestrator) vs `apps/worker` (10 scanners, node:dns, static methods) | One canonical scanner set with unified interface | 🔴 | **Yes** — dual fork blocks all downstream |
| S-2 | Engine has 0 automated tests | Manual `tests/orch.ts` script only | Unit + integration tests for every scanner | 🔴 | **Yes** — no safety net for changes |
| S-3 | Worker DNSSEC scanner is a stub (`passed: true`) | Fakes a pass | Real DNSSEC check or clear "unsupported" label | 🟡 | Deferred (user trust issue) |
| S-4 | Worker WHOIS scanner is a stub (`ageDays: 365`) | Fakes output | Real WHOIS lookup or clearly removed | 🟡 | Deferred |
| S-5 | Worker SMTP scanner (connect-only) | TCP :25 ping | Full banner analysis (like engine's TLS scanner) | 🟡 | Deferred |
| S-6 | Worker TLS scanner checks :443 not :25 | HTTPS cert check | SMTP STARTTLS check (use engine's TLS scanner) | 🟡 | Deferred |
| S-7 | Worker DKIM requires explicit selector | Caller must know selector | Auto-discovery (engine already does this) | 🟡 | Deferred |
| S-8 | Scoring weights differ between engine and worker | Engine: 100−Σweights; Worker: −20/−20/−30/−10/−15/−50 | Single scoring source (engine's) | 🟡 | Deferred |
| S-9 | Blacklist coverage is asymmetric | Engine: dbl.spamhaus + multi.surbl; Worker: IP RBLs + dbl.spamhaus only | One scanner with full RBL list | 🟡 | Deferred |

### 2.4 Web / Control Plane

| # | Gap | Current State | Target State | Severity | Blocker? |
|---|---|---|---|---|---|
| W-1 | Dashboard renders hardcoded data | `page.tsx` is a static mock | Dashboard reads from DB, shows real metrics | 🔴 | **Yes** — core UX |
| W-2 | Domain detail page is hardcoded | `isHealthy = domain === 'google.com'` | Reads scan history; renders real ReportModel | 🔴 | **Yes** — core UX |
| W-3 | `/routing`, `/logs`, `/settings` pages don't exist | Sidebar links to 404s | Implemented or removed from sidebar | 🟡 | Deferred — remove first, add later |
| W-4 | No PDF export component or route | `@react-pdf/renderer` installed, unused | `ReportPDF` component + `/api/export/pdf` route | 🟡 | Deferred to post-v1 |
| W-5 | No CSV export route | Worker has a stub | Real export from DB results | 🟡 | Deferred |
| W-6 | Domain CRUD (add/remove/list) | N/A | POST /api/domains, GET /api/domains, DELETE | 🔴 | **Yes** — no way to onboard a domain |
| W-7 | Scan trigger with history | Single `/api/scan` call, no history | Trigger + persist + list past scans | 🔴 | **Yes** — no repeat scans |

### 2.5 Worker / Data Plane

| # | Gap | Current State | Target State | Severity | Blocker? |
|---|---|---|---|---|---|
| WP-1 | Webhook worker is a stub (log + sleep 50ms) | BullMQ config exists; processor does nothing | Normalizes webhook events, dispatches scan, writes to DB | 🔴 | **Yes** — queue is pointless without work |
| WP-2 | No webhook event normalization | N/A | ESP-specific (SendGrid, Postmark, etc.) parser, maps to `NormalizedWebhookEvent` | 🔴 | **Yes** — worker core purpose |
| WP-3 | No DB write in worker | N/A | Worker writes scan results and audit events | 🔴 | **Yes** |
| WP-4 | Worker scanner pipeline not reachable | `ScoringEngine.evaluateDomain` has no caller | Worker calls engine scanners (or canonical scanners) | 🟡 | Deferred |
| WP-5 | OmniRouteAI not wired | Unused | Used for explainability on scan results | 🟡 | Deferred |

### 2.6 Reliability & Observability

| # | Gap | Current State | Target State | Severity | Blocker? |
|---|---|---|---|---|---|
| R-1 | No structured logging | `console.log` only | Structured JSON logs (pino/winston), correlation IDs | 🟡 | Deferred but high-impact |
| R-2 | No health check with dependencies | `/health` returns `{ status: 'ok' }` always | Health checks DB, Redis, downstreams | 🟡 | Deferred |
| R-3 | No graceful shutdown | Not implemented | SIGTERM → drain queue, close DB, close Fastify | 🟡 | Deferred |
| R-4 | No rate limiting anywhere | N/A | `/api/scan` rate-limited per workspace; webhook dedup | 🔴 | **Yes** — abuse surface |
| R-5 | No error boundary (web) | N/A | React error boundary; API error responses | 🟡 | Deferred |
| R-6 | No metrics/telemetry | N/A | Prometheus metrics or equivalent | 🟡 | Deferred |

---

## 3. Dependency Graph (what blocks what)

```
P-1 (@inboxshield/db importable)  ←── P-2 (migrations)  ←── P-3 (DB queries)
A-1 (real auth)  ←── A-2 (middleware)  ←── A-3 (API auth)
S-1 (unified scanners)  ←── WP-4 (worker uses engine)
WP-1 (real worker)  ←── WP-2 (normalization)  ←── WP-3 (DB writes)
W-1 (live dashboard)  ←── P-3 (DB queries)
W-2 (live domain detail)  ←── W-7 (scan history)  ←── P-3 (DB writes)
W-6 (domain CRUD)  ←── P-3 (DB)
```

**Critical path** (what must happen first):

```
P-1 → P-2 → P-3 → {W-1, W-2, W-6, WP-3}  (all depend on DB being real)
A-1 → A-2 → A-3                             (auth chain)
S-1 → WP-4 → WP-1 → WP-2                    (worker chain)
```

---

## 4. Priority Phases (recommended, from current state)

> **Planning disclaimer:** The effort ratings and phase groupings below are **rough relative planning estimates only** — they are ordering guidance, not evidence-backed completion timelines. No phase is scheduled or resourced; these are recommendations for sequencing work, not commitments.

### Phase 0: Fix foundations (no user-visible change)
Resolve the blockers that make any future work possible.

| Task | Gap(s) | Effort | Risk |
|---|---|---|---|
| Fix `@inboxshield/db` package (add index.ts, export PrismaClient) | P-1 | Low | Low |
| Run `prisma migrate dev` to create initial migration | P-2 | Low | Low |
| Add basic `tsconfig.json` and tests to `packages/engine` | S-2 | Medium | Low |
| Remove `ignoreBuildErrors: true` in `next.config.ts` or fix resulting TS errors | — | Medium | Low |
| Remove or clearly mark dead `packages/db` nested tree | — | Low | Low |
| Remove unused `zod` dep from worker | — | Low | None |

### Phase 1: Auth + basic persistence (first "real" product)

| Task | Gap(s) | Effort | Risk |
|---|---|---|---|
| Add real auth (Google/GitHub OAuth via NextAuth) | A-1 | Medium | Low |
| Add `middleware.ts` for route protection | A-2 | Low | Low |
| Add workspace seeding (one workspace per user, domain CRUD) | W-6, P-3 | Medium | Medium |
| Wire `/api/scan` to write results to DB | P-3, W-7 | Medium | Medium |
| Add rate limiting to `/api/scan` | A-3, R-4 | Low | Low |

### Phase 2: Worker reality

| Task | Gap(s) | Effort | Risk |
|---|---|---|---|
| Unify scanner engines (S-1 — InboxShield product work, see `ASC_INTEGRATION_PLAN.md` §7.2) | S-1 | Medium–High | **High** — touches both apps |
| Implement webhook normalization + DB write | WP-1, WP-2, WP-3 | Medium | Medium |
| Wire worker to use unified scanner set | WP-4 | Low (after S-1) | Low |
| Add scheduled scan trigger (BullMQ repeatable jobs) | W-7 | Medium | Low |

### Phase 3: Dashboard truth + reporting

| Task | Gap(s) | Effort | Risk |
|---|---|---|---|
| Rewrite dashboard to read from DB | W-1 | Medium | Low |
| Rewrite domain detail to render real ReportModel | W-2 | Medium | Low |
| Build `ReportPDF` component + export route | W-4 | Medium | Low |
| Remove /routing, /logs, /settings from sidebar | W-3 | Low | None |

### Phase 4: Production hardening

| Task | Gap(s) | Effort | Risk |
|---|---|---|---|
| Structured logging (pino/winston) | R-1 | Medium | Low |
| Health checks with dependency probes | R-2 | Low | Low |
| Graceful shutdown | R-3 | Low | Low |
| DNSSEC/WHOIS stubs: either implement or remove | S-3, S-4 | Medium | Low |
| CI/CD pipeline (GitHub Actions or equivalent) | — | Medium | Low |
| E2E test suite (Playwright or equivalent) | — | Medium | Low |

---

## 5. What the current state gives the SaaS build (do not rebuild)

| Existing asset | What it enables in the SaaS |
|---|---|
| `@inboxshield/engine` scanner library | The SaaS scan feature is a DB write + orchestrator call + render. The engine is ready. |
| Prisma schema (Workspace→Domain→ScanReport) | The data model for multi-tenant domains is already designed; only migrations and runtime wiring are missing. |
| BullMQ queue configuration | Queue shape (attempts, backoff, retention) is correct; only the processor is missing. |
| Worker Fastify skeleton | Health check + route structure is sound; extend, don't rebuild. |
| Worker scanner utilities | IP-RBL blacklist logic and DNS utilities fill engine gaps; merge, don't discard. |
| `@react-pdf/renderer` | Installed in web; only the `ReportPDF` component needs to be built (the dependency is already satisfied). |
| NextAuth v4 | Auth framework is installed; only the provider strategy needs to change from hardcoded credentials to OAuth. |

---

## 6. What is explicitly NOT in scope for the SaaS (per user rules)

The following are **out of scope** for this audit and for the recommended build-out until explicitly requested:

- ASC-Orchestrator integration (analyzed separately in `ASC_INTEGRATION_PLAN.md`; ASC-Orchestrator v1.0.0 is a separate, already-released Python project — not InboxShield code)
- LLM/AI integration beyond the existing heuristic provider
- Multi-workspace RBAC
- Webhook ingestion from real ESPs (the queue is in scope; real ESP parsing is deferred)
- k6 load testing
- Playwright E2E testing
- Production deployment (the build path is in scope; the actual deployment is not)

---

*This is audit document 2 of 4. Companion documents: `CURRENT_STATE_AUDIT.md`, `ASC_INTEGRATION_PLAN.md`, `TESTING_GAP_ANALYSIS.md`.*
