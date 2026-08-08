# CLAUDE.md — Operating Instructions for AI Coding Agents

> **Authority level:** This file is the primary operating contract for every AI coding agent working in this repository. When this file conflicts with any `docs/formal/` historical document, this file wins. When this file conflicts with executable source code verified against the filesystem, the source code wins and this file must be updated.

---

## 1. Project Identity

**InboxShield AI** — Email Infrastructure & Deliverability Operations Platform

- **Language/runtime:** TypeScript (Node.js ≥ 20)
- **Build system:** Turborepo + npm workspaces
- **Database:** PostgreSQL (Prisma ORM)
- **Queue:** BullMQ + Redis
- **UI:** Next.js 16 (React 19, Tailwind v4, shadcn/ui)
- **Background processing:** Fastify + BullMQ worker

**Product objective:** Deterministic email authentication/infrastructure scanning (SPF, DKIM, DMARC, MX, TLS, DNS, DNSSEC, BIMI, MTA-STS, TLS-RPT), with evidence-based remediation recommendations, agency-grade client management, and a SaaS multi-tenant delivery.

---

## 2. Required Documents — Read Before Coding

Every AI agent must read these before modifying any source file:

| Document | Path | Purpose |
|---|---|---|
| This file | `CLAUDE.md` | Operating instructions (source of authority) |
| PRD | `docs/PRD.md` | Canonical product requirements |
| Architecture | `docs/ARCHITECTURE.md` | Canonical technical architecture |
| Schema | `docs/SCHEMA.md` | Current and target data models |
| API Spec | `docs/API_SPEC.md` | Endpoint contracts, validation rules |
| Current State Audit | `docs/CURRENT_STATE_AUDIT.md` | Verified current repository state |
| SaaS Gap Analysis | `docs/SAAS_GAP_ANALYSIS.md` | What's missing for SaaS |
| ASC Integration Plan | `docs/ASC_INTEGRATION_PLAN.md` | ASC boundary definition |
| Testing Gap Analysis | `docs/TESTING_GAP_ANALYSIS.md` | Testing state and gaps |
| Phase 0 Contract | `docs/PHASE_0_IMPLEMENTATION_CONTRACT.md` | Current implementation authority |
| Tasks | `docs/TASKS.md` | Canonical execution queue |

**Do not trust `docs/formal/` files for current-state claims.** They describe aspirational plans and historical implementation summaries, many of which contradict the actual repository state (see `CURRENT_STATE_AUDIT.md` §6 for 12+ documented false claims).

---

## 3. Source of Truth Hierarchy

When documents conflict, resolve in this order:

1. **Executable repository source code and verified runtime evidence** — the ground truth
2. **Canonical contracts** (`CLAUDE.md`, `PRD.md`, `ARCHITECTURE.md`, `SCHEMA.md`, `API_SPEC.md`) — this document set
3. **Current-state audit** (`CURRENT_STATE_AUDIT.md`) — verified snapshot of repository state
4. **Active implementation contract** (`PHASE_0_IMPLEMENTATION_CONTRACT.md`) — authoritative for Phase 0 execution
5. **Task execution state** (`TASKS.md`) — reflects contract, never overrides it
6. **Historical documentation** (`docs/formal/*`) — never override current evidence

---

## 4. Canonical Repository Locations

```
inboxshield-ai/
├── apps/
│   ├── web/                    # Next.js 16 control plane (UI + API routes)
│   └── worker/                 # Fastify + BullMQ data plane (webhook ingestion, scanning)
├── packages/
│   ├── engine/                 # @inboxshield/engine — deterministic scanner library (persistence-agnostic)
│   ├── db/                     # @inboxshield/db — Prisma persistence layer
│   ├── types/                  # @inboxshield/types — shared TypeScript interfaces
│   ├── typescript-config/      # Shared tsconfig.json files
│   └── eslint-config/          # Shared ESLint config
├── CLAUDE.md                   # This file — operating instructions for AI agents (root-level)
├── docs/                       # Canonical documentation
│   ├── PRD.md                  # Product requirements
│   ├── ARCHITECTURE.md         # Technical architecture
│   ├── SCHEMA.md               # Data models (current + target)
│   ├── API_SPEC.md             # API contracts
│   ├── TASKS.md                # Execution queue
│   ├── CURRENT_STATE_AUDIT.md  # Verified current state (audit doc 1/4)
│   ├── SAAS_GAP_ANALYSIS.md    # Gap analysis (audit doc 2/4)
│   ├── ASC_INTEGRATION_PLAN.md # ASC boundary (audit doc 3/4)
│   ├── TESTING_GAP_ANALYSIS.md # Testing gaps (audit doc 4/4)
│   ├── PHASE_0_IMPLEMENTATION_CONTRACT.md  # Phase 0 execution authority
│   └── formal/                 # HISTORICAL — aspirational docs, do not treat as ground truth
└── turbo.json                  # Turborepo task configuration
```

---

## 5. Architecture Boundaries

### packages/engine — Deterministic Scanner Library

```
@inboxshield/engine
├── src/core/types.ts        # ScannerResult, BaseScanner, EngineReport
├── src/core/orchestrator.ts # EngineOrchestrator (register, analyzeDomain, calculateGlobalScore)
├── src/scanners/            # 7 scanners: DNS, SPF, DKIM, DMARC, MX, TLS, Blacklist
├── src/ai/provider.ts       # AiProvider interface, AiRecommendation
├── src/ai/heuristic.provider.ts  # HeuristicAiProvider (flag-based recommendations)
├── src/report/builder.ts    # ReportBuilder → ReportModel
├── src/report/types.ts      # ReportModel, PresentationSection
├── src/utils/doh.client.ts  # DoHClient (Cloudflare DNS-over-HTTPS)
└── src/index.ts             # Public API exports
```

**Rules for packages/engine:**
- **Deterministic scanner/evidence/report domain ONLY**
- **Persistence-agnostic:** No PrismaClient, no PostgreSQL imports, no DB CRUD, no repositories
- **Framework-agnostic:** No Next.js, no Fastify, no React, no HTTP
- **Scanner execution is isolated:** each scanner implements `BaseScanner.execute(domain) → ScannerResult`
- **SafeExecute wraps each scanner:** a failing scanner never crashes the orchestrator
- **Scoring is deterministic:** `100 - Σ(scoreWeight)` for failed scanners
- **ReportModel is the immutable evidence snapshot** (versioned, never mutated after creation)
- `packages/db` may `import type` from engine; `packages/engine` NEVER imports `packages/db`

### packages/db — Persistence Layer

- **Prisma + PostgreSQL only**
- `packages/db/package.json` `main` currently points to nonexistent `index.ts` (known defect, P0-02)
- `packages/db/prisma/schema.prisma` is the canonical Prisma schema (verified, `prisma validate` passes)
- HistoryService currently lives in dead tree `packages/db/packages/engine/src/services/` — must be migrated to `packages/db/src/services/` (P0-04)
- `packages/db` owns all DB reads/writes; `apps/web` and `apps/worker` consume `packages/db` exports

### apps/web — Control Plane (Next.js)

- **User-facing UI:** Dashboard, domain detail, scan triggering
- **API routes:** `POST /api/scan` (engine orchestrator), `NextAuth /api/auth/[...nextauth]`
- **Current state:** hardcoded demo data, no DB wiring, no real auth, `ignoreBuildErrors: true`
- **PDF rendering:** `@react-pdf/renderer` installed, no implementation yet
- **UI components:** shadcn/ui (button, card, progress) + custom Sidebar, MetricCard
- **Sidebar links to:** `/domains`, `/routing` (OmniRoute), `/logs`, `/settings` — all return 404 currently

### apps/worker — Data Plane (Fastify + BullMQ)

- **Fastify HTTP gateway** on port 3001: `/health` (GET), `/v1/webhooks/:esp` (POST)
- **BullMQ queue** `webhook-ingestion`: 3 attempts, exponential backoff, concurrency 50
- **Webhook worker:** stub only (log + sleep 50ms, no real processing)
- **10 independent scanners** using `node:dns` (NOT DoH): DNS, SPF, DKIM, DMARC, MX, TLS, SMTP, DNSSEC, WHOIS, IP Blacklist
- **`ScoringEngine`**: separate from `packages/engine`, duplicates scoring logic with different weights
- **`OmniRouteAI`**: stub explainability — heuristic spam-score simulation, no LLM integration
- **`ReportGenerator`**: stub — returns fake CSV string and `Buffer.from("%PDF-1.4...")`
- **No test infrastructure**

---

## 6. Runtime Boundaries

### BullMQ Boundary

- BullMQ owns **low-level job execution, retries, scheduling, and webhook processing**
- The `webhook-ingestion` queue receives raw ESP payloads from Fastify
- The webhook worker **processes events, normalizes data, writes to DB** (currently stub)
- BullMQ does NOT own high-level mission orchestration — that is ASC-Orchestrator's future domain
- BullMQ must NOT be replaced by ASC-Orchestrator

### ASC-Orchestrator Boundary

- **ASC-Orchestrator v1.0.0 is a separate, already-released Python project**
- **Must NOT be copied, vendored, or forked into this TypeScript monorepo**
- **Must NOT replace BullMQ**
- **Must NOT perform low-level scans, DNS lookups, or determine SPF/DKIM/DMARC pass/fail**
- **Must NOT own factual deliverability truth**
- ASC's future role: high-level mission orchestration (open → evidence-gated progress → re-verify → close/escalate) — referenced by scan/evidence IDs, never duplicating scanner data
- See `docs/ASC_INTEGRATION_PLAN.md` for the full boundary definition
- **Not part of current Phase 0 implementation**

### AI / OmniRouteAI Boundary

- **AI may explain deterministic findings** — translate scanner flags into human-readable recommendations
- **AI must NEVER invent scanner facts, scores, DNS truth, authentication status, reputation status, or compliance facts**
- `HeuristicAiProvider` (engine) is deterministic — flag-based, no LLM calls
- `OmniRouteAI` (worker) is a stub — basic keyword heuristics only, no external API calls
- Future LLM providers must conform to the `AiProvider` interface and return evidence-grounded recommendations only

---

## 7. Truth Rules

These are invariant. Never violate them.

### Status truth

```
NOT CHECKED ≠ FAILED
UNSUPPORTED ≠ PASS
UNSUPPORTED ≠ FAIL
```

An unimplemented scanner must report `UNSUPPORTED` (or `NOT_IMPLEMENTED`) with `passed: null`, never a fabricated `passed: true` or `passed: false`.

### Evidence rules

- **Scanner results are deterministic facts.** An AI provider must never override a scanner's pass/fail determination.
- **ReportModel is an immutable snapshot.** Once created by `ReportBuilder.build()`, the `reportModel` object must never be mutated.
- **`ScanReport.reportModel`** is stored as `Json` in PostgreSQL. It is the source of truth for what was scanned and when.
- **Scores are derived from scanner results.** A score of `100 - Σ(weights)` must be deterministic for the same inputs.

### Build truth

```
Build succeeds ≠ Type-check passes ≠ Runtime correct ≠ Production ready
```

- `next build` exits 0 is necessary but not sufficient
- `tsc --noEmit` exits 0 is necessary but not sufficient
- `turbo run build` passes is necessary but not sufficient
- Actual behavior must be verified by tests (unit, integration, E2E) and manual validation

### Anti-fabrication rule

Never fabricate data, results, or verification claims:
- Never return hardcoded scanner results as if they were live
- Never return fake file content (e.g., `Buffer.from("%PDF-1.4...")`) as if it were real
- Never claim a database migration ran successfully if it did not actually run
- Never claim tests pass if they were not actually executed
- When a check is not performed, report it as NOT_IMPLEMENTED/UNSUPPORTED, not PASS or FAIL

---

## 8. Build / Lint / Typecheck / Test Commands

### Current state (what works today)

```bash
# Root commands (via Turborepo)
npm run build          # turbo run build — all workspaces
npm run dev            # turbo run dev
npm run lint           # turbo run lint — limited coverage
npm run format         # prettier --write
npm run test           # turbo run test — NO TASKS DEFINED (no-op)

# Per-workspace
cd packages/engine && npm run build     # tsc
cd apps/web && npm run build            # next build (ignoreBuildErrors: true)
cd apps/worker && npm run build         # tsc

# Prisma
cd packages/db && npx prisma generate
cd packages/db && npx prisma validate   # requires DATABASE_URL
```

### Known defects in build tooling

| Defect | Location | Fix |
|---|---|---|
| `turbo.json` has no `test` task | `turbo.json` | Add `"test": { "dependsOn": ["^build"] }` |
| `turbo.json` has no `typecheck` task | `turbo.json` | Add `"typecheck": { "dependsOn": ["^build"] }` |
| `next.config.ts` has `ignoreBuildErrors: true` | `apps/web/next.config.ts` | Remove after fixing TS errors (P0-05) |
| `@inboxshield/db` `main: "index.ts"` points to nonexistent file | `packages/db/package.json` | Fix in P0-02 |
| `@inboxshield/types` `main: "index.ts"` — file exists but unused | `packages/types/package.json` | Deferred |

### After Phase 0

```bash
npx turbo run build && npx turbo run lint && npx turbo run typecheck && npx turbo run test
```

---

## 9. Database Commands

```bash
# Schema validation
cd packages/db && npx prisma validate

# Generate PrismaClient
cd packages/db && npx prisma generate

# Create migration (requires live PostgreSQL)
cd packages/db && npx prisma migrate dev --name <name>

# Apply migration
cd packages/db && npx prisma migrate deploy

# Reset database (DESTRUCTIVE — dev only)
cd packages/db && npx prisma migrate reset

# Generate migration SQL without a live DB (for CI/development)
cd packages/db && npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
```

**Environment:**
```
DATABASE_URL=postgresql://user:password@localhost:5432/inboxshield?schema=public
DATABASE_URL_TEST=postgresql://user:password@localhost:5432/inboxshield_test?schema=public
REDIS_URL=redis://localhost:6379
```

---

## 10. Coding Conventions

- **TypeScript strict mode** — all packages use `strict: true`
- **ES module syntax** — import/export, no CommonJS (`require`) except where absolutely necessary
- **File naming:** `kebab-case.ts` for source files
- **Class naming:** `PascalCase` (e.g., `EngineOrchestrator`, `HeuristicAiProvider`)
- **Interface naming:** `PascalCase` with no `I` prefix
- **Scanner IDs** use colon-separated namespaces: `auth:spf`, `auth:dkim`, `network:dns:a_record`, `network:smtp:tls`, `network:blacklist:domain`
- **Error handling:** scanners never throw to the orchestrator — `safeExecute` catches and returns a `ScannerResult` with `passed: null` and `SCANNER_FAULT` flag (a scanner fault is an ERROR — no definitive PASS/FAIL verdict; `passed: false` is only for a confirmed FAIL)
- **API responses:** consistent `{ data: T }` or `{ error: string }` shapes
- **No `any` types** — use `unknown` and narrow; `Record<string, any>` in `ReportModel.technicalAppendix` is intentional (arbitrary scanner data)
- **Co-locate tests** with source: `scanner.test.ts` alongside `scanner.ts`

---

## 11. Deterministic Evidence Rules

### Scanner contract (`BaseScanner`)

```typescript
interface BaseScanner {
  readonly id: string;
  readonly description: string;
  execute(domain: string): Promise<ScannerResult>;
}

interface ScannerResult {
  scannerId: string;
  passed: boolean | null; // true ONLY for PASS; false ONLY for FAIL; null when no definitive verdict (ERROR/UNSUPPORTED/DISABLED/PARTIAL)
  scoreWeight: number;    // 0-100, penalty when passed === false
  rawData: unknown;       // raw DNS data, certificates, etc.
  error?: string;         // human-readable error when passed is false or null
  flags: string[];        // standardized flags for AI layer
}
```

### Worker scanner contract (after P0-07)

Worker stubs gain a `ScanStatus` field:
```typescript
type ScanStatus = 'PASS' | 'FAIL' | 'ERROR' | 'UNSUPPORTED' | 'DISABLED' | 'PARTIAL';
```
Invariant truth table (`passed` is `boolean | null`):
```
PASS        -> passed: true
FAIL        -> passed: false
ERROR       -> passed: null
UNSUPPORTED -> passed: null
DISABLED    -> passed: null
PARTIAL     -> passed: null
```
`passed` never carries a fabricated boolean when no definitive PASS/FAIL verdict exists — the truthful meaning lives in `status` + `error`.

### ReportModel (immutable evidence snapshot)

```typescript
interface ReportModel {
  metadata: { domain: string; generatedAt: string; version: string };
  executiveSummary: { score: number; riskLevel: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'; statusText: string; riskColor: string };
  authentication: PresentationSection[];
  infrastructure: PresentationSection[];
  recommendations: AiRecommendation[];
  technicalAppendix: Record<string, any>;
}
```

`ReportBuilder.build()` sets `metadata.version = '1.0.0'` (P0-09 freezes this).

### Scoring formula

```
globalScore = 100 - Σ(scoreWeight for scanners where passed === false)
globalScore = max(globalScore, 0)

riskLevel:
  ≥ 90 → LOW
  ≥ 70 → MEDIUM
  ≥ 40 → HIGH
  <  40 → CRITICAL
```

---

## 12. Security Rules

- **No hardcoded credentials in source** — the current `admin@inboxshield.ai` / `test` in NextAuth is a known security defect (audit A-1)
- **SSRF defense** on `/api/scan`: block RFC1918/loopback/link-local IP resolution targets (P0-08)
- **Domain input validation**: RFC-compliant hostname regex, max 253 chars, valid TLD (P0-08)
- **Rate limiting**: `RateLimiter` interface with `LocalMemoryRateLimiter` (dev-only, per-domain token bucket 10 req/min); production uses `RedisRateLimiter` (Phase 1)
- **No `error.message` leakage**: 500 responses return generic messages only (P0-08)
- **Timeout**: `AbortSignal.timeout(30_000)` on scan calls (P0-08)
- **No secrets in code** — use environment variables exclusively

---

## 13. Unsupported-Feature Truth Policy

| Feature | Current state | Truth policy |
|---|---|---|
| DNSSEC scanner (worker) | Always returns `passed: true` | Must report `UNSUPPORTED` (P0-07) |
| WHOIS scanner (worker) | Returns `{ passed: true, ageDays: 365 }` | Must report `UNSUPPORTED` with no fabricated `ageDays` (P0-07) |
| SMTP scanner (worker) | TCP connect only, JSDoc claims "banner grab" | Must report `PARTIAL` with explicit scope note (P0-07) |
| PDF export (worker) | Returns `Buffer.from("%PDF-1.4...")` | Must throw `NOT_IMPLEMENTED` error (P0-07) |
| CSV export (worker) | Returns hardcoded CSV string | Must throw `NOT_IMPLEMENTED` error (P0-07) |
| Dashboard (web) | Hardcoded `84/100`, static domains | Must show visible "Demo data" disclaimer (P0-07) |
| Webhook worker (worker) | Log + sleep 50ms, does nothing | Leave as-is; already makes no fabrication claim |
| Auth (web) | Hardcoded `admin@inboxshield.ai` / `test` | Must be replaced with real auth (Phase 1) |
| DB write/read (web/worker) | No runtime DB queries | Must be implemented (Phase 1) |

**Rule: if you did not run a check, you do not know its result. Report NOT_IMPLEMENTED, not PASS or FAIL.**

---

## 14. Git Workflow

- **Branch strategy:** `main` is the primary integration branch; feature work on named branches (e.g., `audit/*`, `feat/*`, `fix/*`)
- **Commit messages:** Conventional Commits format: `type(scope): description`
  - `test:` for new tests
  - `fix:` for bug fixes
  - `feat:` for new features
  - `chore:` for maintenance/cleanup
  - `docs:` for documentation
  - `ci:` for CI changes
  - `refactor:` for structural changes without behavior change
- **One implementation unit = one commit** — each P0-XX unit is a single commit with a clear message
- **No automatic push** — commits stay local until explicitly pushed
- **No automatic tags or releases** — tagging is manual
- **Co-authorship:** If AI contributed, append `Co-Authored-By: Claude <noreply@anthropic.com>` to the commit message

---

## 15. Stop / Block / Report Rules

### Stop and do NOT proceed if:

- A file modification contradicts an invariant in this document without explicit user override
- A change would make `packages/engine` import from `packages/db` (creates a dependency cycle)
- A change fabricates a scanner result (e.g., returning `passed: true` for a stub)
- A change would introduce runtime dependencies into `packages/engine` (Prisma, PostgreSQL, HTTP, React)
- A migration is claimed to have run successfully without actually running it against a live database
- Tests are claimed to pass without being actually executed

### Block and report if:

- A `docs/formal/` claim contradicts verified source code state
- A PR modifies files outside the scope of the claimed task
- A change breaks the build (`turbo run build`) or type-check (`turbo run typecheck`)
- The source-of-truth hierarchy requires resolving a contradiction between documents

### Report always:

- State what was verified vs. what was assumed
- Distinguish IMPLEMENTED from PLANNED when describing features
- When uncertain about current state, read the filesystem before claiming anything

---

## 16. Phase 0 Current Scope

**Do NOT implement Phase 0 tasks until explicitly authorized.** Phase 0 consists of 10 implementation units (P0-01 through P0-10) defined in `docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`. Each unit is one commit.

Phase 0 fixes foundations (no user-visible changes):
1. P0-01: Testing infrastructure (Vitest in engine)
2. P0-02: `@inboxshield/db` package repair
3. P0-03: Prisma migration baseline
4. P0-04: HistoryService migration to `packages/db`
5. P0-05: Type-safety enforcement (remove `ignoreBuildErrors`)
6. P0-06: Scanner unification plan + IP-RBL migration
7. P0-07: Stub quarantine with truthful status taxonomy
8. P0-08: `/api/scan` security hardening
9. P0-09: Deterministic evidence contracts (versioned ReportModel)
10. P0-10: CI validation gates (GitHub Actions)

**Current Phase 0 status:** NOT_STARTED — awaiting approval to begin P0-01.

---

*This is the canonical operating instruction file for AI coding agents in this repository. It supersedes any conflicting claims in `docs/formal/` historical documents. Last verified against repository source: 2026-08-08.*
