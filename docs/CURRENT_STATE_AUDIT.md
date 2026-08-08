# InboxShield AI — Current State Audit (Independent Truth Baseline)

**Date:** 2026-08-08
**Type:** Independent, read-only audit of the repository as it exists on disk
**Baseline:** branch `audit/inboxshield-saas-baseline`, HEAD `17cd585`
**Method:** Every claim below was verified directly against source files. Documentation was treated as unverified claims and cross-checked against code. Compilation success was not treated as proof of runtime correctness.

> This document records what the application **actually is** today, not what the documentation claims it is, and not what it should become. It is the ground truth baseline against which the SaaS build-out (see `SAAS_GAP_ANALYSIS.md`) and the ASC-Orchestrator boundary (see `ASC_INTEGRATION_PLAN.md`) are measured. Note: ASC-Orchestrator is a **separate, already-released Python project**; it is not InboxShield code and is only analyzed here, never integrated.

---

## 1. Classification Standard

Every component in this audit is assigned exactly one classification, defined as follows:

| Class | Definition |
|---|---|
| **WORKING** | Functional at runtime, produces real output, exercised by a running path or demonstrably runnable |
| **PARTIAL** | Works, but only covers a subset of its stated responsibility; gaps are material |
| **STUB** | Present as an interface or placeholder, returns fabricated/constant output, does no real work |
| **BROKEN** | Present but cannot run, errors at startup/import, or produces wrong output |
| **UNTESTED** | Real implementation with no automated test coverage |
| **DEAD** | Not imported/referenced anywhere in the live tree; unreachable code |
| **MISSING** | Required by the documented design or by the subsystem's own contract, but absent from the repo |
| **UNKNOWN** | Could not be verified without an external service, credentials, or runtime the audit was not authorized to start |

> **Compile status ≠ runtime status.** The prior baseline commit (HEAD `17cd585`) verified `npm run build` PASS, lint PASS, typecheck PASS, and `npm audit` clean (no high-severity findings). Those are compile-time and dependency-health checks **only**. They say nothing about runtime correctness, security correctness, or production readiness. Every runtime claim in this audit was verified by reading code paths on disk, not by compilation.

---

## 2. Executive Verdict

**The repository contains one workable, reachable core — the `@inboxshield/engine` scanner library — surrounded by a substantial amount of scaffolding, hardcoded placeholders, duplicate/dead code, and documentation that substantially overstates what is implemented.**

At a high level:

- **What works:** The engine's 7 DNS/email-security scanners (DoH-based), the EngineOrchestrator that runs them concurrently, the HeuristicAiProvider recommendation logic, the ReportBuilder, and one unauthenticated web endpoint (`POST /api/scan`) that exercises the engine end-to-end.
- **What is placeholder:** The entire worker "data plane" (BullMQ webhook worker is a stub, PDF/CSV export is a stub, 3 of 10 worker scanners are stubs), the web dashboard (all hardcoded data), authentication (hardcoded credentials), and all persistence (zero database queries exist at runtime).
- **What is misleading:** The documentation (README, ReleaseReadinessReport, docs/formal/*) claims persistent scan history, PDF export, a full REST API, encryption, circuit breakers, test infrastructure, and a "10/10 ready for release" state. None of those exist. Several documents describe a **different product** (the pre-V1 SaaS vision) than what was built.
- **What is duplicated:** A full abandoned second tree under `packages/db/` contains dead copies of the worker, the engine, and documentation — including a **working** Prisma-based HistoryService that is not wired into anything.
- **What is the immediate blocker:** The two scanner systems (`packages/engine` vs `apps/worker`) are independent, incompatible, and both partially dead-ended. Any SaaS build that does not first resolve this fork will duplicate work.

**Readiness verdict: NOT production-ready.** The correct framing is that this is a **functional proof-of-concept scanner library with a placeholder application shell** around it. It is genuinely reusable as a scanner engine; it is not reusable as a SaaS product yet.

---

## 3. Actual Architecture (as-built, not as-documented)

```
┌──────────────────────────────────────────────────────────────────┐
│ apps/web  (Next.js 16.3.0)            "Control plane" (documented)│
│  ┌──────────────────────────────┐                                │
│  │ Dashboard (page.tsx)         │  HARDCODED: score 84/100,      │
│  │  /  /domains/[domain]        │  hardcoded domain list,        │
│  └──────────────────────────────┘  isHealthy = domain==='google' │
│  ┌──────────────────────────────┐                                │
│  │ /api/scan/route.ts           │  ONLY live engine consumer.    │
│  │  → EngineOrchestrator        │  No auth, no rate limit,       │
│  │  → 7 scanners                │  no input validation.          │
│  │  → HeuristicAiProvider       │                                │
│  │  → ReportBuilder             │                                │
│  └──────────────────────────────┘                                │
│  ┌──────────────────────────────┐                                │
│  │ /api/auth/[...nextauth]      │  STUB: hardcoded admin/test    │
│  └──────────────────────────────┘                                │
│  × middleware.ts                 MISSING (no route protection)   │
│  × Prisma usage                  MISSING (zero DB queries)       │
│  × /routing /logs /settings      MISSING (sidebar links, 404)    │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ apps/worker  (Fastify 5.11 + BullMQ)   "Data plane" (documented) │
│  ┌──────────────────────────────┐                                │
│  │ index.ts  :3001              │  /health, POST /v1/webhooks/:esp│
│  │  → BullMQ queue (3 attempts) │   → enqueues, worker is STUB   │
│  │  → webhook.worker.ts         │   logs + sleeps 50ms, no work  │
│  └──────────────────────────────┘                                │
│  ┌──────────────────────────────┐                                │
│  │ engine/scoring.engine.ts     │  SECOND, INDEPENDENT engine    │
│  │  → 10 static-method scanners │  node:dns (not DoH), different │
│  │  → ScoringEngine.evaluate    │  scoring (-20/-20/-30/-15/-50) │
│  └──────────────────────────────┘                                │
│  ┌──────────────────────────────┐                                │
│  │ ai/omni.route.ts             │  keyword spam check, canned    │
│  └──────────────────────────────┘  DMARC explanations            │
│  ┌──────────────────────────────┐                                │
│  │ api/reports.ts               │  STUB CSV + fake "%PDF" buffer │
│  └──────────────────────────────┘                                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ packages/engine  (framework-agnostic)        ← the real engine   │
│  EngineOrchestrator + BaseScanner + safeExecute + scoreWeights   │
│  7 scanners (DoH via Cloudflare):                                │
│   dns / spf / dkim / dmarc / mx / smtp-tls / blacklist           │
│  HeuristicAiProvider (deterministic flag-based recommendations)  │
│  ReportBuilder → ReportModel                                     │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ packages/db  (Prisma schema only, broken package resolution)     │
│  prisma/schema.prisma: Workspace→Domain→ScanReport               │
│  × NO migrations, NO index.ts (main points at missing file)      │
│  └─ DEAD nested tree: apps/worker/, packages/engine/, docs/      │
│       (older copies, incl. a working Prisma HistoryService)      │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ packages/types — EmailPayload + NormalizedWebhookEvent.          │
│   IMPORTED NOWHERE.                                              │
│ packages/eslint-config — not used by apps/web.                   │
│ packages/typescript-config — used by some packages.             │
└──────────────────────────────────────────────────────────────────┘
```

**The documented architecture** (docs/formal/06) describes a Next.js "Control Plane" + Node/Fastify "Data Plane" split. That split exists **structurally** but not **functionally**: the two apps do not talk to each other. The web app does not call the worker. The worker does not call the web app. They share no code path and no data.

---

## 4. Subsystem Truth Tables

### 4.1 packages/engine — the scanner engine (primary reusable implementation — functionally implemented but **unverified for production**)

> **Classification caveat:** "WORKING" here means *functionally implemented and runnable*, not *production-grade*. The engine has **no meaningful automated test suite** (`TESTING_GAP_ANALYSIS.md` §1: zero tests exist). It is the primary reusable implementation to build on, but it is unverified for production until covered by tests. Do not read §4.1 as evidence of production readiness.

| Component | File | Class | Evidence |
|---|---|---|---|
| Scanner interface | `src/core/types.ts` | **WORKING** | `BaseScanner` (id, description, execute→ScannerResult) and `EngineReport` types are coherent |
| Orchestrator | `src/core/orchestrator.ts` | **WORKING / UNTESTED** | Registers scanners, runs Promise.all, safeExecute wraps faults, score = 100 − Σweights, thresholds <40 CRITICAL / <70 HIGH / <90 MEDIUM. No test suite. |
| DNS (A record) | `src/scanners/dns.scanner.ts` | **WORKING / UNTESTED** | DoHClient.resolve(domain,'A'), weight 20 |
| SPF | `src/scanners/spf.scanner.ts` | **WORKING / UNTESTED** | DoH TXT, v=spf1 prefix, RFC 7208 multiple-SPF, ~all/-all/?all policy, weight 30/20 |
| DKIM | `src/scanners/dkim.scanner.ts` | **PARTIAL / UNTESTED** | Tries 7 selectors sequentially, infers key size from record length (coarse heuristic — not a real bit-length parse) |
| DMARC | `src/scanners/dmarc.scanner.ts` | **WORKING / UNTESTED** | DoH `_dmarc.` TXT, policy, weight 40/15 (p=none) |
| MX | `src/scanners/mx.scanner.ts` | **WORKING / UNTESTED** | DoH MX, null-MX detection, weight 20 |
| SMTP TLS | `src/scanners/tls.scanner.ts` | **WORKING / UNTESTED** | Raw TCP :25 → EHLO → STARTTLS → tls.connect upgrade; cert expiry/protocol/self-signed checks; 5s timeout. **Requires outbound :25 — frequently blocked; runtime reachability UNKNOWN in deployed environments.** |
| Blacklist (domain) | `src/scanners/blacklist.scanner.ts` | **WORKING / UNTESTED** | dbl.spamhaus.org + multi.surbl.org via node:dns A-record, weight 50 |
| DoH client | `src/utils/doh.client.ts` | **WORKING / UNTESTED** | Cloudflare DoH, 5s timeout |
| AI provider interface | `src/ai/provider.ts` | **WORKING** | Clean `AiProvider` contract |
| Heuristic AI | `src/ai/heuristic.provider.ts` | **WORKING / UNTESTED** | Deterministic flag-based recommendations (7 checks). **Not an LLM.** Correctly named. |
| ReportBuilder | `src/report/builder.ts` | **WORKING / UNTESTED** | EngineReport + AiRecommendation → ReportModel (metadata, executiveSummary, auth[], infrastructure[], recommendations[], technicalAppendix) |
| Report types | `src/report/types.ts` | **WORKING** | Coherent |
| `tests/orch.ts` | | **NOT A TEST** | Manual demo script with console.log; no assertions, no framework. **Do not mistake this for test coverage.** |

**Engine summary:** a real, runnable, dependency-free scanner library — functionally implemented but **unverified for production** (no automated tests, `TESTING_GAP_ANALYSIS.md` §1). Its main weaknesses: (a) zero automated tests; (b) DKIM key-size inference is heuristic; (c) the SMTP TLS scanner needs open egress :25; (d) blacklist scanner does **not** check IP-based RBLs; (e) scoring weights are hardcoded with no tunability.

### 4.2 apps/worker — the "data plane"

| Component | File | Class | Evidence |
|---|---|---|---|
| Fastify server | `src/index.ts` | **WORKING / UNTESTED** | :3001, /health, POST /v1/webhooks/:esp → enqueue. No tests. |
| BullMQ queue | `src/queue/bullmq.config.ts` | **WORKING / UNTESTED** | 'webhook-ingestion', 3 attempts, exponential backoff, removeOnComplete, keep 1000 failures. Requires Redis. |
| Webhook worker | `src/queue/webhook.worker.ts` | **STUB** | Concurrency 50, but body is: log + `await sleep(50)`. No normalization, no DB write, no dispatch. **The queue exists; the processor does nothing.** |
| ScoringEngine | `src/engine/scoring.engine.ts` | **PARTIAL / UNTESTED / DUPLICATE** | Independent from engine's EngineOrchestrator. Hardcoded details object, scoring −20/−20/−30/−10/−15/−50. Inconsistent with engine weights. |
| DNS scanner | `src/scanners/dns.scanner.ts` | **WORKING / UNTESTED** | node:dns/promises (not DoH) — different from engine |
| SPF scanner | `src/scanners/spf.scanner.ts` | **WORKING / UNTESTED** | Static verify(), returns {passed, record, error?} |
| DKIM scanner | `src/scanners/dkim.scanner.ts` | **PARTIAL / UNTESTED** | **Requires selector arg; no auto-discovery** (engine does discovery) |
| DMARC scanner | `src/scanners/dmarc.scanner.ts` | **WORKING / UNTESTED** | Static verify() |
| MX scanner | `src/scanners/mx.scanner.ts` | **WORKING / UNTESTED** | node:dns; **no null-MX detection** (engine has it) |
| Blacklist scanner | `src/scanners/blacklist.scanner.ts` | **WORKING / UNTESTED** | Checks IP RBLs (zen.spamhaus, barracuda, spamcop) + dbl.spamhaus. **Different scope than engine** (engine: no IP RBLs, does multi.surbl). |
| DNSSEC scanner | `src/scanners/dnssec.scanner.ts` | **STUB** | Always `{ passed: true }`; comment admits DNSSEC requires DNSKEY/AD reading. **False sense of security.** |
| SMTP scanner | `src/scanners/smtp.scanner.ts` | **PARTIAL** | Only TCP :25 connectivity; no EHLO/STARTTLS/banner |
| TLS scanner | `src/scanners/tls.scanner.ts` | **PARTIAL / DUPLICATE** | Connects to **:443 (HTTPS)**, not :25 SMTP. Different from engine's SMTP STARTTLS scanner. |
| WHOIS scanner | `src/scanners/whois.scanner.ts` | **STUB** | Always `{ passed: true, ageDays: 365 }` |
| OmniRouteAI | `src/ai/omni.route.ts` | **PARTIAL** | explainDmarcFailure() → 3 canned strings; analyzeEmailPayload() → keyword spam check. **No LLM.** |
| ReportGenerator | `src/api/reports.ts` | **STUB** | CSV = hardcoded string; PDF = `Buffer.from("%PDF-1.4…")` fake. |

**Worker summary:** a skeleton with a real queue and real DNS utilities, but the only "feature" that runs start-to-finish is a no-op webhook processor. The scanner set here (10) is **larger but shallower** than the engine's (7), and the two systems share nothing.

### 4.3 apps/web — the "control plane"

| Component | File | Class | Evidence |
|---|---|---|---|
| Dashboard | `src/app/page.tsx` | **BROKEN (as a product), WORKING (as a static mock)** | "84/100" hardcoded; domain list hardcoded; no fetch, no DB |
| Domain detail | `src/app/domains/[domain]/page.tsx` | **BROKEN (as a product), WORKING (as a static mock)** | `isHealthy = domain === 'google.com'`; all scanner results hardcoded strings |
| Scan API | `src/app/api/scan/route.ts` | **WORKING / UNTESTED / UNAUTHENTICATED** | **The only live engine path in the whole repo.** No auth, no rate limiting, only `if (!domain)` validation. |
| NextAuth | `src/app/api/auth/[...nextauth]/route.ts` | **STUB** | Hardcoded `admin@inboxshield.ai` / `test`, JWT strategy |
| Sidebar | `src/components/Sidebar.tsx` | **PARTIAL** | Links to `/routing`, `/logs`, `/settings` — pages **DON'T EXIST** (404) |
| MetricCard | `src/components/MetricCard.tsx` | **DEAD** | Not imported by any visible page |
| ReportPDF / PDF route | | **MISSING** | Claimed in docs; absent |
| middleware.ts | | **MISSING** | No route protection whatsoever |
| Database access | | **MISSING** | `@inboxshield/db` and `@prisma/client` are installed deps; **zero queries** |

**Web summary:** a static dashboard mock. The single real value is `/api/scan` (unauthenticated, unvalidated) which proves the engine works through Next.js.

### 4.4 packages/db — database

| Component | File | Class | Evidence |
|---|---|---|---|
| Prisma schema | `prisma/schema.prisma` | **WORKING (schema)** | Workspace→Domain→ScanReport (score, riskLevel, reportModel Json), useful indexes |
| Migrations | | **MISSING** | No migrations directory; `prisma migrate` never run |
| Package resolution | `package.json` | **BROKEN** | `main: "index.ts"` — **no index.ts exists**. `@inboxshield/db` is not importable. |
| Runtime usage | | **MISSING** | Zero DB queries in apps/web or apps/worker |

**Dead nested tree inside packages/db (DEAD code) — reconfirmed from disk (2026-08-08):** the `packages/db` directory contains exactly seven files (excluding `node_modules`), and a repository-wide search confirms **zero live imports** of `@inboxshield/db` or `packages/db` anywhere in `apps/` or `packages/` source. Exact inventory:

| Path | What it is | Class | Action before any deletion |
|---|---|---|---|
| `packages/db/prisma/schema.prisma` | **The canonical schema** (Workspace→Domain→ScanReport) | **WORKING (schema)** | **KEEP** — do not delete; this is the live product schema |
| `packages/db/package.json` | The `@inboxshield/db` manifest; `main: "index.ts"` but **no index.ts exists** | **BROKEN** | **KEEP + FIX** — add `index.ts`/exports so the package resolves (fix, not deletion) |
| `packages/db/package-lock.json` | Stale lockfile for the db package | **STALE** | Regenerate after the index fix, or remove if workspace-managed |
| `packages/db/packages/engine/src/services/history.service.ts` | **Working Prisma HistoryService** — `saveSnapshot(db, reportModel, workspaceId)`, `getHistory(db, {workspaceId, limit, domainFilter, riskFilter})`, `getSnapshot(db, reportId, workspaceId)` with workspace-scoping | **DEAD — FUNCTIONALITY MUST BE MIGRATED BEFORE DELETION** | **Rescue first:** this is the only implemented persistence logic in the repo. Migrate into the canonical tree (e.g., `packages/engine/src/services/` or a future persistence package) **before** removing the nested tree, or the code is lost |
| `packages/db/packages/engine/src/index.ts` | Engine exports **+ HistoryService** re-export (not in canonical engine) | **DEAD** | Removable once HistoryService is migrated |
| `packages/db/apps/worker/src/index.ts` | Older Fastify stub (health + webhook), earlier version of `apps/worker` | **DEAD** | Removable; no functionality unique to it |
| `packages/db/docs/formal/16-Documentation-Completion-Summary.md` | Older documentation variant (V1-pivot wording), **different from** canonical `docs/formal/16` | **DEAD** | Removable; superseded by canonical doc |

**Migration rule:** the HistoryService must be rescued before the nested tree is deleted; nothing else in the tree carries functionality that exists nowhere else.

### 4.5 packages/types — shared types

| Component | Class | Evidence |
|---|---|---|
| EmailPayload, NormalizedWebhookEvent | **DEAD** | Defined, **imported nowhere** in the entire repo |

### 4.6 packages/eslint-config, packages/typescript-config

| Component | Class | Evidence |
|---|---|---|
| eslint-config | **DEAD (for web)** | apps/web has its own `eslint.config.mjs`; doesn't consume this |
| typescript-config | **USED** | Referenced by worker/engine/etc. |

---

## 5. Runtime Reachability (what can actually be exercised today)

This is the map of paths that a user/operator could actually reach:

1. **`POST /api/scan` (web :3000)** → EngineOrchestrator → 7 scanners → HeuristicAiProvider → ReportBuilder → JSON. ✅ **Fully reachable, end-to-end.** This is the only real feature.
2. **Web dashboard (`/`, `/domains/[domain]`)** → renders hardcoded data. ✅ Reachable, ❌ not connected to anything.
3. **Worker `/health` (:3001)** → returns ok. ✅
4. **Worker `POST /v1/webhooks/:esp`** → enqueues to BullMQ → worker logs + sleeps. ✅ Reachable, ❌ does nothing useful. Requires Redis running.
5. **Worker scanner pipeline** → no HTTP or queue path invokes it. `ScoringEngine.evaluateDomain` has no caller. ❌ **Not reachable at runtime.**
6. **OmniRouteAI** → no caller. ❌ Not reachable.
7. **ReportGenerator** → no route. ❌ Not reachable.
8. **Database** → no code path touches Prisma at runtime. ❌ Not reachable.
9. **Auth** → NextAuth route exists, but no middleware, no protected pages, and `/api/scan` is wide open. ⚠️ Effectively unauthenticated.
10. **PDF/CSV export** → no route. ❌ Not reachable.

**Net:** Exactly **one** useful runtime path exists. Everything else is scaffolding, mock data, or unreachable code.

---

## 6. Working / Partial / Stub / Broken / Untested / Dead / Missing Roll-up

### WORKING (real, reachable or runnable)
- `packages/engine` — all 7 scanners, orchestrator, DoH client, heuristic provider, report builder (all untested, but genuinely functional)
- `apps/web/api/scan/route.ts` — the one live engine path
- Worker Fastify server + health + BullMQ queue enqueue (requires Redis)
- Worker DNS/SPF/DMARC/MX/blacklist scanner methods (as utilities; not wired to a path)
- Prisma schema itself (schema is valid; `prisma validate` passes)

### PARTIAL
- Engine DKIM (selector heuristic)
- Worker ScoringEngine (duplicate, inconsistent, unwired)
- Worker DKIM (no discovery), MX (no null-MX), SMTP (connect-only), TLS (:443 not :25)
- Web Sidebar (dead links)

### STUB
- Worker webhook processor
- Worker DNSSEC scanner
- Worker WHOIS scanner
- Worker ReportGenerator (CSV + PDF)
- Web NextAuth credentials
- OmniRouteAI "AI" (canned strings — arguably PARTIAL since it returns usable text)

### BROKEN
- `packages/db` package resolution (`main` → missing index.ts)
- Sidebar links to non-existent routes (product-level broken UX)
- Dashboard/domain pages as a *product* (they work as mocks, fail as features)

### UNTESTED
- **Everything** with real logic. There is **zero automated test coverage in the repository** (no test framework, no test scripts, no test files). `tests/orch.ts` is a manual script.

### DEAD
- Entire `packages/db/` nested tree (duplicate worker, engine, docs)
- `packages/db/.../history.service.ts` (working persistence, unwired)
- `packages/types` (imported nowhere)
- Web `MetricCard`
- `zod` dependency in worker (never imported)

### MISSING
- DB migrations, DB runtime access
- PDF component + export route
- Auth middleware / session enforcement / rate limiting / input validation on `/api/scan`
- `/routing`, `/logs`, `/settings` pages
- Any CI/CD
- Any test infrastructure
- Any real LLM/AI integration (the "AI" in the product name is not backed by a model today)

### UNKNOWN
- SMTP TLS scanner (port 25) behavior in real deployments — depends on network egress
- Anything requiring external credentials/services the audit did not run

---

## 7. Production Blockers (in priority order)

1. **Dual, incompatible scanner systems.** `packages/engine` (interface-based, DoH, orchestrator) and `apps/worker` (static methods, node:dns, own ScoringEngine) are two parallel implementations of the same domain. A SaaS build cannot proceed cleanly until this fork is resolved. This is **InboxShield product architecture** (scanner unification, see `ASC_INTEGRATION_PLAN.md` §7.2) — not ASC-Orchestrator work. This is the #1 blocker.
2. **Zero persistence.** Scan results are generated and thrown away. The documented "Persistent Scan History" does not exist at runtime. Prisma exists but nothing calls it; `@inboxshield/db` is not even importable.
3. **Zero authentication/authorization on the only live endpoint.** `/api/scan` is open, unrate-limited, unvalidated — a trivial abuse/DNS-amplification vector and a hard stop for any real deployment.
4. **Zero test infrastructure.** No test runner, no CI gate, no fixtures. Even if code were perfect, there is no safety net for the rewrite work this product needs.
5. **Fabricated outputs in place of real features.** DNSSEC/WHOIS always "pass"; PDF/CSV export returns garbage; dashboard shows hardcoded numbers. These are silent lies — worse than a missing feature, because they appear to work.
6. **The docs describe a different product.** README, ReleaseReadinessReport, and several docs/formal files describe capabilities that don't exist (or that were stripped in the "V1 pivot" that the docs themselves document inconsistently). Anyone planning from the docs will plan wrong.

---

## 8. Security Concerns (current state)

| Concern | Severity | Detail |
|---|---|---|
| Unauthenticated scan endpoint | **HIGH** | `POST /api/scan` open to anyone; no rate limit; cheap DoH proxy to Cloudflare is the least of it — attacker-controlled domains trigger outbound DNS, SMTP (:25), and TLS connections from the server. SSRF/abuse surface. |
| Hardcoded credentials | **HIGH** | `admin@inboxshield.ai` / `test` in source. Any NextAuth-protected page (once middleware is added) would be trivially breakable. |
| No auth middleware | **HIGH** | No route protection exists at all. |
| "Always passes" scanners | **MEDIUM** | DNSSEC and WHOIS stubs return `passed: true`. A user sees a green health check that is meaningless. Integrity issue. |
| No input validation | **MEDIUM** | Scan route only checks `if (!domain)`. No hostname normalization, no SSRF defense, no payload limits. |
| No secrets management | **MEDIUM** | `.env` referenced in .gitignore, but there is no documented secret handling; worker/DB creds assumed in plain env. |
| TLS scanner egress | **LOW** | Connecting to :25 from the server is by-design for a deliverability tool, but it is also a capability that can be misused if the endpoint is public. |
| Dependency audit | **UNKNOWN** | Prior session ran `npm audit` and hardened deps; `npm audit` reported no high-severity vulnerabilities at baseline. No runtime verification of those claims in this audit. |
| `ignoreBuildErrors: true` | **LOW** | `next.config.ts` suppresses TS errors at build — real type errors can ship silently. |

---

## 9. Technical Debt (ranked)

1. **The packages/db dead tree** — a full abandoned duplicate of worker + engine + docs living inside a package that is itself broken. Every new engineer who opens the repo will be confused about which tree is canonical.
2. **The engine/worker scanner fork** — two implementations, different DNS stacks, different scoring, different scanner inventories. Every future change is paid twice or fixed twice.
3. **Scoring inconsistency** — engine: `100 − Σ(weights)`, weights 20/30/20/40/20/50; worker: −20/−20/−30/−10/−15/−50. Two different numeric languages for "domain health."
4. **Hardcoded UI** — dashboard and domain pages render constants; any future wiring means replacing, not extending.
5. **Stub-as-real** — DNSSEC/WHOIS/PDF/CSV return fabricated data. Removing them or clearly gating them is work nobody has budgeted.
6. **Unused dependencies** — `zod` (worker), `@prisma/client` + `@inboxshield/db` (web) installed but unused; `packages/types` dead.
7. **Non-importable package** — `@inboxshield/db` `main` points to a nonexistent file.
8. **Docs drift** — formal docs describe pre-V1 SaaS features as if implemented; two contradictory "completion summary" docs (canonical vs `packages/db` copy).
9. **`next.config.ts` `ignoreBuildErrors`** — masks type errors.
10. **No migrations** — even the schema that exists cannot be applied.

---

## 10. Reusable Implementation (what the SaaS build starts from)

These are the pieces worth keeping — they are the real asset of this repo:

> **Readiness caveat:** "reusable" means *a sound starting point*, not *ready for production*. Every item below is functionally implemented but **unverified for production** — none has automated test coverage (`TESTING_GAP_ANALYSIS.md` §1) and several are not yet wired to a runtime path (`CURRENT_STATE_AUDIT.md` §5).

| Asset | Where | Why it's reusable |
|---|---|---|
| Scanner engine + orchestrator | `packages/engine/src/` | Clean `BaseScanner` contract, concurrency via `Promise.all`, per-scanner `safeExecute` fault isolation, weight-based scoring, threshold risk levels. **This is the core. Do not rebuild it.** |
| DoH client | `packages/engine/src/utils/doh.client.ts` | Framework-agnostic, timeouts, avoids node:dns variance |
| HeuristicAiProvider | `packages/engine/src/ai/heuristic.provider.ts` | Deterministic recommendations; a sane fallback even after a real LLM is added |
| ReportBuilder + ReportModel | `packages/engine/src/report/` | Domain → structured report; the report schema is the persistence payload of the future |
| Prisma schema | `packages/db/prisma/schema.prisma` | Workspace→Domain→ScanReport is a sound v1 model; needs migrations + index.ts |
| HistoryService (dead) | `packages/db/packages/engine/src/services/history.service.ts` | Working Prisma persistence logic — **rescue this**, it's already written |
| Worker DNS/scanner methods | `apps/worker/src/scanners/*` | The IP-RBL blacklist logic and DNS utilities exceed the engine's; merge into one canonical set |
| BullMQ queue wiring | `apps/worker/src/queue/` | Sound queue config (attempts, backoff, retention); only the processor is missing |
| Worker Fastify skeleton | `apps/worker/src/index.ts` | Clean health + route bootstrap |

---

## 11. Explicit "Do NOT" Registers

Nothing in this audit modifies code. The following are recorded here so the audit itself is unambiguous about scope:

- No application code was changed. (Git status remained clean at HEAD `17cd585`.)
- No dependencies were changed or upgraded.
- No new SaaS features were added.
- ASC-Orchestrator was **not** integrated (only analyzed — see `ASC_INTEGRATION_PLAN.md`). ASC-Orchestrator v1.0.0 is a **separate, already-released Python project**; it was never part of the monorepo, was not copied in, and was not vendored.
- No pushes, merges, releases, or tags were made.
- Documentation was treated as **claims**, never as proof.

---

*This is audit document 1 of 4. Companion documents: `SAAS_GAP_ANALYSIS.md`, `ASC_INTEGRATION_PLAN.md`, `TESTING_GAP_ANALYSIS.md`.*
