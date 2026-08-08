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
| P0-02 | `@inboxshield/db` package repair | Create `packages/db/src/index.ts` (PrismaClient singleton, `globalThis` caching); fix `main` → `src/index.ts` | — | `NOT_STARTED` | Prereq for P0-03 |
| P0-03 | DB migration baseline | Generate initial Prisma migration; primary path (real PG) or fallback path (deterministic diff SQL + mark `BLOCKED-on-DB`); never claim runtime verification that did not happen | P0-02 | `NOT_STARTED` | Requires PostgreSQL availability decision at execution time |
| P0-04 | Dead-tree classification & cleanup | Migrate `HistoryService` → `packages/db/src/services/history.service.ts` (type-only `ReportModel` import); delete 5 dead-tree files; engine stays persistence-agnostic | P0-01, P0-02, P0-03 | `NOT_STARTED` | Deletes `packages/db/packages/`, `packages/db/apps/`, `packages/db/docs/`, `packages/db/package-lock.json` |
| P0-05 | Type-safety enforcement | Remove `ignoreBuildErrors` from `next.config.ts`; fix surfaced errors; add `typecheck` task to `turbo.json` | P0-01 | `NOT_STARTED` | `turbo.json` currently has build/lint/dev only |
| P0-06 | Scanner unification plan + IP-RBL migration | Create `IpBlacklistScanner` in engine (migrated from worker, unique value); write `docs/SCANNER_UNIFICATION_REPORT.md`; DO NOT delete worker scanners | P0-01 | `NOT_STARTED` | Worker IP-RBL: zen.spamhaus + barracuda + spamcop |
| P0-07 | Stub / fabricated-output quarantine | Create `ScanStatus` taxonomy (`PASS/FAIL/ERROR/UNSUPPORTED/DISABLED/PARTIAL`) in `apps/worker/src/scanners/types.ts`; DNSSEC/WHOIS → UNSUPPORTED; SMTP → PARTIAL; reports → NOT_IMPLEMENTED throw; dashboard → demo disclaimer. Contract: `passed: boolean | null` (`true` = PASS, `false` = FAIL, `null` = ERROR/UNSUPPORTED/DISABLED/PARTIAL). | P0-01 | `NOT_STARTED` | Truth rule: PASS→true, FAIL→false, ERROR/UNSUPPORTED/DISABLED/PARTIAL→`passed: null`; `UNSUPPORTED ≠ PASS`; `UNSUPPORTED ≠ FAIL`; no fabricated `passed` |
| P0-08 | `/api/scan` security hardening | Domain validation + SSRF defense + 30s timeout + safe errors + pluggable `RateLimiter` interface (`LocalMemoryRateLimiter` dev-only; Redis documented as production boundary) | P0-01, P0-05 | `NOT_STARTED` | Fixes the `error.message` leak on 500 |
| P0-09 | Deterministic evidence contracts | Add `version: '1.0.0'` to `ReportModel.metadata`; JSDoc `@immutable` on `rawData`; shape contract tests for `ScannerResult`/`EngineReport`/`ReportModel` | P0-01 | `NOT_STARTED` | Freezes the evidence snapshot contract |
| P0-10 | CI validation gates | `.github/workflows/ci.yml` with 8 gates: `npm ci`, `npm audit`, `prisma generate`, `prisma validate`, build, lint, typecheck, test | P0-01…P0-09 | `NOT_STARTED` | CI only — no CD/deploy steps |

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
| V1-06 | `RedisRateLimiter` production implementation behind the `RateLimiter` interface | `NOT_STARTED` |
| V1-07 | Scanner unification: worker scanners replaced by canonical `@inboxshield/engine` calls | `NOT_STARTED` |
| V1-08 | Worker real webhook processing (normalize ESP events → `EmailEvent` in DB) | `NOT_STARTED` |
| V1-09 | Scheduled scans (BullMQ repeatable jobs) | `NOT_STARTED` |
| V1-10 | Real PDF export (`@react-pdf/renderer`) + real CSV export | `NOT_STARTED` |
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
- **No P0 unit has been started.** All ten are `NOT_STARTED`, awaiting explicit user approval.
- This document is updated when a unit's status changes (after a commit lands and acceptance criteria are verified).

---

*This is the canonical execution queue. Task states supersede any historical task lists. Last updated: 2026-08-08.*
