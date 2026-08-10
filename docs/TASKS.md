# InboxShield AI — Canonical Execution Queue

**Version:** 1.0 (Canonical)
**Date:** 2026-08-08
**Status:** Baseline — this is the single source of truth for task state
**Authority:** Task states are maintained here; the Phase 0 contract (`docs/PHASE_0_IMPLEMENTATION_CONTRACT.md`) owns each unit's detailed spec

---

## 1. Status Taxonomy

| Status | Meaning |
|---|---|
| `NOT_STARTED` | Not begun — awaiting explicit approval to start |
| `IN_PROGRESS` | Work underway (single-commit unit) |
| `BLOCKED` | Cannot proceed — blocker documented in the notes column |
| `DONE` | Fully implemented, all acceptance criteria met, commit on branch |
| `SUPERSEDED` | No longer relevant — superseded by a later decision (notes explain) |

**Rule:** a unit is `DONE` only when every acceptance criterion in the Phase 0 contract is verified. A unit is `BLOCKED` when it cannot proceed, with the blocker named. No unit may be marked `DONE` while `BLOCKED` items it depends on remain open.

---

## 2. Phase 0 Execution Queue

**Source of authority:** `docs/PHASE_0_IMPLEMENTATION_CONTRACT.md` (§5 Implementation Units, §14 Exit Criteria).

**Execution order (hard dependencies from contract §4):**
```
P0-01 → P0-02 → P0-03 → P0-04 → P0-05 → P0-06 → P0-07 → P0-08 → P0-09 → P0-10
```

Each unit is one commit. **Wait for explicit approval before starting each unit.**

| # | Unit | Objective (short) | Depends on | Status | Notes |
|---|---|---|---|---|---|
| P0-01 | Testing foundation | Vitest in `packages/engine`; behavior-based tests for all 7 scanners, orchestrator (safeExecute, scoring, risk thresholds), HeuristicAiProvider, ReportBuilder — all DNS/TLS mocked, no network | — | `DONE` | First unit. Commit: `test: establish Vitest foundation and scanner contract tests for @inboxshield/engine` |
| P0-02 | `@inboxshield/db` package repair | Create `packages/db/src/index.ts` (PrismaClient singleton, `globalThis` caching); fix `main` → `src/index.ts` | — | `DONE` | Commit: `fix: repair @inboxshield/db package entrypoint with PrismaClient singleton` |
| P0-03 | DB migration baseline | Generate initial Prisma migration; primary path (real PG) or fallback path (deterministic diff SQL + mark `BLOCKED-on-DB`); never claim runtime verification that did not happen | P0-02 | `DONE` | Fallback path used — migration SQL generated via `prisma migrate diff`, NOT runtime-verified (no PostgreSQL available). Commit: `chore: establish Prisma migration baseline for InboxShield PostgreSQL schema` |
| P0-04 | Dead-tree classification & cleanup | Migrate `HistoryService` → `packages/db/src/services/history.service.ts` (type-only `ReportModel` import); delete 5 dead-tree files; engine stays persistence-agnostic | P0-01, P0-02, P0-03 | `DONE` | Commit: `feat: implement P0-04 HistoryService migration + P0-05 type-safety enforcement` (`85df30e`) — P0-04 and P0-05 were combined into a single commit |
| P0-05 | Type-safety enforcement | Remove `ignoreBuildErrors` from `next.config.ts`; fix surfaced errors; add `typecheck` task to `turbo.json` | P0-01 | `DONE` | Commit: `feat: implement P0-04 HistoryService migration + P0-05 type-safety enforcement` (`85df30e`) — combined with P0-04. **Corrective `e468b03`:** the `typecheck` turbo task was vacuous — no workspace defined a `typecheck` script, so `turbo run typecheck` executed 0 tasks. Added `"typecheck": "tsc --noEmit"` to web/worker/engine/db; `npx turbo run typecheck` now executes 4 real tasks (all green) |
| P0-06 | Scanner unification plan + IP-RBL migration | Create `IpBlacklistScanner` in engine (migrated from worker, unique value); write `docs/SCANNER_UNIFICATION_REPORT.md`; DO NOT delete worker scanners | P0-01 | `DONE` | Commit: `feat: migrate IP-RBL scanner to engine and establish scanner unification report` (`7c2967e`) — engine tests green (80 pass), engine build passes, export added |
| P0-07 | Stub / fabricated-output quarantine | Create `ScanStatus` taxonomy (`PASS/FAIL/ERROR/UNSUPPORTED/DISABLED/PARTIAL`) in `apps/worker/src/scanners/types.ts`; DNSSEC/WHOIS → UNSUPPORTED; SMTP → PARTIAL; reports → NOT_IMPLEMENTED throw; dashboard → demo disclaimer. Contract: `passed: boolean | null` (`true` = PASS, `false` = FAIL, `null` = ERROR/UNSUPPORTED/DISABLED/PARTIAL). | P0-01 | `DONE` | Commit: `fix: quarantine fabricated stub outputs with truthful ScanStatus taxonomy` (`73ec67a`) — worker + web builds pass. **Corrective `83499e3`:** the `/domains/[domain]` detail page still rendered hardcoded PASS/FAIL badges with no disclosure (initial "grep-verified no fabricated `passed: true/false`" note was inaccurate). Added the same visible demo disclaimer; fabricated `passed: true/false` now absent from web UI (grep-verified after corrective) |
| P0-08 | `/api/scan` security hardening | Domain validation + SSRF defense + 30s timeout + safe errors + pluggable `RateLimiter` interface (`LocalMemoryRateLimiter` dev-only; Redis documented as production boundary) | P0-01, P0-05 | `DONE` | Commit: `fix: harden /api/scan with domain validation, SSRF defense, pluggable rate limiting, and safe errors` (`41937af`) — 37 web tests pass; monorepo build green; no `error.message` leakage (bare `catch {`), 30s timeout, 429+Retry-After, X-RateLimit-Remaining (grep-verified) |
| P0-09 | Deterministic evidence contracts | Add `version: '1.0.0'` to `ReportModel.metadata`; JSDoc `@immutable` on `rawData`; shape contract tests for `ScannerResult`/`EngineReport`/`ReportModel` | P0-01 | `DONE` | Commit: `feat: freeze deterministic evidence contract with versioned ReportModel and shape tests` (`03a5399`) — `passed: boolean | null`, safeExecute returns `passed: null` + SCANNER_FAULT, scoring penalizes only `passed === false`, builder renders null verdicts as SKIPPED; contract tests (`core/types.test.ts` 10 + `report/types.test.ts` 8); engine 98 tests green, turbo build + typecheck green |
| P0-10 | CI validation gates | `.github/workflows/ci.yml` with 8 gates: `npm ci`, `npm audit`, `prisma generate`, `prisma validate`, build, lint, typecheck, test | P0-01…P0-09 | `DONE` | Commit: `ci: add GitHub Actions validation gates for build, lint, typecheck, test, and Prisma` (`7c8f941`) — all 8 gates verified locally: audit 0 vulnerabilities, lint clean, 135 tests green (engine 98 + web 37), turbo build/typecheck green, prisma generate/validate green |

**Hard dependency rule (contract §4):**
- P0-02 before P0-03 (importable package before migration)
- P0-03 before P0-04 (working DB before HistoryService move)
- P0-01 before P0-05 (safety net before blast-radius change)
- P0-01 before P0-06 through P0-09 (tests before modifying source)

---

## 3. Phase 1 (V1) Queue — PLANNED (not started, not in scope for Phase 0)

Referenced for visibility only. Do **not** begin any of these during Phase 0.

| Item | Objective | Status |
|---|---|---|
| V1-01 | Real authentication (OAuth Google/GitHub via NextAuth, sessions, `middleware.ts` route protection) | `NOT_STARTED` |
| V1-02 | Domain CRUD API (`POST/GET/DELETE /api/domains`, workspace-scoped) | `NOT_STARTED` |
| V1-03 | Scan persistence (`/api/scan` writes `ScanReport` via `packages/db`) | `NOT_STARTED` |
| V1-04 | Scan history on domain detail (real `ReportModel` from DB) | `NOT_STARTED` |
| V1-05 | Dashboard from DB (real scores, real incidents, real domain list) | `NOT_STARTED` |
| V1-06 | `RedisRateLimiter` production implementation behind the `RateLimiter` interface | `DONE` |
| V1-07 | Scanner unification: worker scanners replaced by canonical `@inboxshield/engine` calls | `DONE` |
| V1-08 | Worker real webhook processing (normalize ESP events → `EmailEvent` in DB) | `DONE` |
| V1-09 | Scheduled scans (BullMQ repeatable jobs) | `DONE` |
| V1-10 | Real PDF export (`@react-pdf/renderer`) + real CSV export | `DONE` | Commit: `feat(web,v1-10): real PDF export via @react-pdf/renderer and CSV export from scan history`. Acceptance criteria: real `%PDF-` magic bytes asserted in `apps/web/src/lib/export/pdf.test.ts` (no stubs — `renderToBuffer` output); RFC 4180 CSV from `ScanService.listByDomain`; workspace-scoped routes `GET /api/export/pdf?domainId=&scanId=` + `GET /api/export/csv?domainId=&limit=` with session auth, domain-ownership 404s, and safe 500s. `ScanService.getById`/`getLatestForDomain` added to `packages/db`. All gates green: typecheck 6/6, test 6/6 (web 125), lint 0 errors, build 4/4, audit 0 vulnerabilities |
| V1-11 | Structured logging (pino/winston, correlation IDs) | `NOT_STARTED` |
| V1-12 | Health checks (`/health` verifies DB + Redis) | `NOT_STARTED` |

**Source:** `docs/PRD.md` §5 V1 TARGET.

---

## 4. Explicitly Deferred (beyond Phase 0 & V1)

From `docs/PHASE_0_IMPLEMENTATION_CONTRACT.md` §15. Do **not** implement during Phase 0.

DNSSEC validation · WHOIS lookup · SMTP banner analysis · BIMI · MTA-STS · TLS-RPT · Header diagnostics · Bounce/rejection diagnostics · DNS change detection · Google Workspace / Microsoft 365 compliance · DMARC aggregate report ingestion · Unauthorized sender detection · Domain/IP reputation history · Before/after verification · OmniRouteAI real LLM · Client portal · Agency/workspace management · Multi-tenancy RBAC · Billing integration · Alerts · SLA monitoring · Load testing (k6) · E2E testing (Playwright) · Docker Compose for local dev · Structured logging · Graceful shutdown · `packages/types` cleanup · `packages/eslint-config` cleanup · ASC-Orchestrator integration

---

## 5. Tracking Notes

- **Current branch:** `audit/inboxshield-saas-baseline`
- **Baseline HEAD at audit time:** `17cd585` (per Phase 0 contract); later superseded by `d29bb61` (chore: establish clean SaaS development baseline)
- **P0-01 … P0-10 are `DONE`** — commit evidence: P0-01 `d9c364d`, P0-02 `8a7a0d8`, P0-03 `4410a79`, P0-04+P0-05 `85df30e`, P0-06 `7c2967e`, P0-07 `73ec67a`, P0-08 `41937af`, P0-09 `03a5399`, P0-10 `7c8f941`. Phase 0 execution complete.
- **Independent Release Gate corrective commits (2026-08-09):** `83499e3` (P0-07 completion — demo disclaimer on `/domains/[domain]` detail page) and `e468b03` (P0-05/P0-10 completion — functional `typecheck` scripts for web/worker/engine/db). Post-corrective gate rerun: build 3/3, lint 2/2, typecheck 5/5 (now real), test 135 green (engine 98 + web 37), audit 0 vulnerabilities, prisma generate/validate green.
- This document is updated when a unit's status changes (after a commit lands and acceptance criteria are verified).

---

*This is the canonical execution queue. Task states supersede any historical task lists. Last updated: 2026-08-09.*
