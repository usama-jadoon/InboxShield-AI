# InboxShield AI — Phase 0 Implementation Contract

**Date:** 2026-08-08
**Type:** Implementation contract (no code changes until explicitly approved)
**Baseline:** branch `audit/inboxshield-saas-baseline`, HEAD `17cd585`
**Scope:** Phase 0 only — establish a safe, deterministic, testable product foundation

> This is a planning document. **Nothing here is implemented until the user gives explicit approval and says "implement P0-XX".** Every implementation unit below is a single commit that can be independently validated and reverted.

---

## 1. Phase 0 Goal

Establish the minimum foundation that makes all subsequent work (SaaS expansion, scanner unification, ASC-Orchestrator integration) safe to attempt. Phase 0 does not deliver user-visible features. It delivers:

- a test suite that catches regressions
- a working database layer
- honest (not fabricated) output from every reachable component
- type-safety that actually runs in CI
- a security baseline on the only live endpoint
- a clear scanner unification path with evidence preserved
- CI gates that block broken code from being committed

**Phase 0 exit means:** every P0-XX unit is committed, all validation gates pass, and a developer can safely begin Phase 1 (real auth, DB wiring, scanner unification) without flying blind.

---

## 2. Current Baseline

**Branch:** `audit/inboxshield-saas-baseline`, HEAD `17cd585` (chore: finalize secure dependency baseline)

**Compile/static status (all PASS):**
- `npm run build` — PASS (all workspaces)
- `npm run lint` — PASS
- `tsc --noEmit` — PASS (where typecheck exists)
- `npm audit` — 0 high-severity findings
- `prisma validate` — PASS (requires DATABASE_URL)

**Runtime status (truth from `CURRENT_STATE_AUDIT.md`):**
- Exactly **one** live runtime path: `POST /api/scan` → engine → JSON (ephemeral, not persisted)
- Dashboard: hardcoded data (84/100, hardcoded domain list)
- Worker: queue accepts jobs, processor is a sleep(50) stub
- Persistence: zero DB queries at runtime; `@inboxshield/db` not importable
- Auth: hardcoded credentials, no middleware
- Tests: zero test files, zero assertions, zero test framework installed
- CI: no workflow files exist

**Scanner architecture:** two independent systems (`packages/engine` 7 scanners DoH, `apps/worker` 10 scanners node:dns), no shared code, different scoring formulas, different DNS stacks.

**Key type configs confirmed:**
- `apps/web/tsconfig.json`: `strict: true`, `noEmit: true`, bundler resolution — errors are masked by `ignoreBuildErrors: true` in `next.config.ts`, not by tsconfig
- `packages/engine/tsconfig.json`: `strict: true`, ES2022, `declaration: true`, `outDir: dist`, `rootDir: src`

---

## 3. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Test framework** | Vitest | TypeScript-native, fast, ESM-compatible, minimal config, already referenced in `docs/formal/11-Testing.md` |
| **Mocking** | `vi.mock()` per-module for DoHClient | Engine scanners are pure functions over DNS; mock at the DoH boundary for deterministic tests |
| **API testing** | Vitest + native `fetch` (Next.js route handlers accept `Request`) | No need for Supertest when testing route handlers directly with standard `Request` objects |
| **Database test strategy** | Separate `DATABASE_URL_TEST` via `schema push` (not migration) for test DB | Test DB is ephemeral; schema push is fast; production uses migrations |
| **Scanner contract test** | Generic `BaseScanner` interface validator | Any scanner implementation must satisfy `id: string`, `description: string`, `execute(domain): Promise<ScannerResult>` with correct shape |
| **Type safety** | Remove `ignoreBuildErrors`, run `next build` to surface errors, fix each | `tsconfig.json` already has `strict: true`; errors are in the Next.js build pipeline, not raw `tsc` |
| **Rate limiting** | Pluggable `RateLimiter` interface; `LocalMemoryRateLimiter` for local/dev only; Redis-backed `RedisRateLimiter` documented as the production-deployment target | Redis is already part of the product architecture (BullMQ). Phase 0 uses the interface plus a local in-memory implementation that is explicitly single-process, resets on restart, and is **NOT production protection** — it must be swapped for the Redis-backed limiter before any multi-instance or production deployment |
| **Stub policy** | Fabricated success → error with `"UNSUPPORTED"` status | Never silently lie; let callers know the feature is unimplemented |
| **Engine is canonical** | `packages/engine` is the single source of scanner truth | Worker IP-RBL logic migrates into engine; worker scanners are compared then deprecated (not deleted in Phase 0) |
| **Engine persistence boundary** | `packages/engine` owns scanner contracts, deterministic scanner execution, evidence/report models, deterministic scoring/rules, and orchestration **ONLY** — it never imports PrismaClient or performs any persistence | Keeps the engine framework-agnostic and persistence-agnostic; all database/history/repository logic lives in `packages/db` (reusable persistence) or the app service layer (`apps/web`, `apps/worker`) |

---

## 4. Dependency Ordering

```
P0-01  Testing foundation ─────────────────────────────────┐
P0-02  @inboxshield/db repair ────┐                         │
P0-03  DB migration baseline ─────┤                         │
P0-04  Dead-tree cleanup ─────────┤                         │
P0-05  Type-safety enforcement ───┤                         ├── ALL require P0-01
P0-06  Scanner unification plan ──┤                         │
P0-07  Stub quarantine ───────────┤                         │
P0-08  /api/scan security ────────┤                         │
P0-09  Evidence contracts ────────┤                         │
P0-10  CI validation gates ───────┘────────────────────────┘
```

**Hard dependencies:**
- P0-02 before P0-03 (must have importable package before migration)
- P0-03 before P0-04 (moving HistoryService into `packages/db` requires a working DB)
- P0-01 before P0-05 (safety net before blast-radius change)
- P0-01 before P0-06 through P0-09 (tests before modifying source)

**Soft dependencies (recommended, not blocking):**
- P0-05 before P0-08 (type errors fixed before security hardening edit)
- P0-06 before P0-07 (understand scanner landscape before quarantine)

**Recommended execution order (matches the user's objective sequence):**

```
P0-01 → P0-02 → P0-03 → P0-04 → P0-05 → P0-06 → P0-07 → P0-08 → P0-09 → P0-10
```

---

## 5. Implementation Units

### P0-01 — Testing Foundation

**Objective:** Install Vitest, configure it for `packages/engine`, and write the first meaningful scanner + orchestrator + builder tests that cover all 7 scanners, the orchestrator, HeuristicAiProvider, and ReportBuilder. These tests exist **before** any scanner consolidation or source modification.

**Files expected to change/create:**
| Path | Action |
|---|---|
| `packages/engine/package.json` | Modify: add `"test": "vitest run"`, `"test:watch": "vitest"` to scripts; add `vitest` to devDependencies |
| `packages/engine/vitest.config.ts` | Create: Vitest config with `test.include: ['src/**/*.test.ts']`, environment `node` |
| `packages/engine/src/__mocks__/doh.client.ts` | Create: canonical mock factory — `createMockDoH(answers)` returns a mock DoHClient |
| `packages/engine/src/core/orchestrator.test.ts` | Create |
| `packages/engine/src/scanners/dns.scanner.test.ts` | Create |
| `packages/engine/src/scanners/spf.scanner.test.ts` | Create |
| `packages/engine/src/scanners/dkim.scanner.test.ts` | Create |
| `packages/engine/src/scanners/dmarc.scanner.test.ts` | Create |
| `packages/engine/src/scanners/mx.scanner.test.ts` | Create |
| `packages/engine/src/scanners/blacklist.scanner.test.ts` | Create |
| `packages/engine/src/scanners/tls.scanner.test.ts` | Create (mocked TCP/TLS — no network) |
| `packages/engine/src/ai/heuristic.provider.test.ts` | Create |
| `packages/engine/src/report/builder.test.ts` | Create |

**Files that must NOT change:** `apps/*`, `packages/db/*`, `packages/types/*`, any scanner source files (only new test files are written)

**Prerequisites:** None (first unit)

**Implementation steps:**
1. Add `vitest` to `packages/engine/package.json` devDependencies
2. Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts
3. Create `packages/engine/vitest.config.ts` (node environment, src include pattern)
4. Create mock factory: `createMockDoH(answers: {type, name, data}[])` that replaces DoHClient.resolve and DoHClient.query with predetermined DNS answers
5. For each scanner (dns, spf, dkim, dmarc, mx, blacklist, tls): write a test file mocking DoHClient, testing at minimum:
   - **Valid case:** well-formed DNS response → `passed: true`, correct `scoreWeight`, correct `flags`
   - **Missing/empty case:** no records → `passed: false`, correct error message
   - **Malformed case:** malformed DNS data → `passed: false`, graceful handling (no throw)
   - **Blacklist-specific:** listed → `passed: false`, not listed → `passed: true`
   - **TLS-specific:** mock TLS handshake success and failure paths (expired cert, weak protocol) via `vi.mock('tls')`
6. For `orchestrator.test.ts`: test with mock scanners (implement BaseScanner), verify:
   - `safeExecute` catches scanner throws → scanner result has error, other scanners still run
   - `calculateGlobalScore`: all pass → 100, all fail → correct minimum, mixed → correct
   - `analyzeDomain` runs all registered scanners (verify count)
   - Empty orchestrator → returns domain with score 100 (no penalties)
7. For `heuristic.provider.test.ts`: test with EngineReport shapes triggering each of 7 flags:
   - Missing SPF → recommendation about SPF
   - p=none DMARC → recommendation about DMARC policy
   - Missing DKIM → recommendation
   - Weak TLS → recommendation
   - Blacklisted → recommendation
   - All healthy → no recommendations (empty array)
   - Mixed → correct subset of recommendations
8. For `builder.test.ts`: test with valid EngineReport + AiRecommendation[], verify:
   - ReportModel shape has all required fields (metadata, executiveSummary, authentication[], infrastructure[], recommendations[], technicalAppendix)
   - Empty scanner results → empty presentation sections
   - Score/riskLevel correctly propagated to executiveSummary
9. Run `npm run test` from `packages/engine/` to verify all tests pass

**Tests required (behavior-based — no assertion-count target; a count may be reported after implementation but is not an acceptance criterion):**
- Every canonical engine scanner (dns, spf, dkim, dmarc, mx, tls, blacklist): success path (PASS), missing/absent record path (FAIL), and malformed DNS/network response path (ERROR — graceful, no throw)
- TLS scanner additionally: expired cert, weak protocol, self-signed, unreachable port, EHLO failure, STARTTLS unsupported
- EngineOrchestrator: `safeExecute` fault isolation (one scanner throws → other scanners still run, error captured only in that scanner's result), deterministic score calculation (all pass → 100, all fail → minimum, mixed), risk thresholds (CRITICAL/HIGH/MEDIUM/LOW), empty scanner set
- HeuristicAiProvider: each flag path produces the correct recommendation subset; no flags → healthy, no recommendations; all flags → unhealthy
- ReportBuilder: full `ReportModel` contract (metadata, executiveSummary, authentication[], infrastructure[], recommendations[], technicalAppendix) for valid input, minimal input, and error-path input
- All DNS/TLS I/O is mocked — no test may make a real network call

**Validation commands:**
```bash
cd packages/engine && npx vitest run          # all tests pass
cd packages/engine && npm run build            # build still works after adding vitest
cd packages/engine && npm run test             # via script
```

**Rollback criteria:** `git revert` the single commit; all source and config remain as they were.

**Commit message:** `test: establish Vitest foundation and scanner contract tests for @inboxshield/engine`

**Acceptance criteria:**
- [ ] `npm run test` in `packages/engine/` exits 0
- [ ] Every canonical engine scanner is covered for success, failure, and malformed DNS/network-response paths (where applicable)
- [ ] Orchestrator test covers safeExecute fault isolation
- [ ] HeuristicAiProvider test covers each flag path
- [ ] ReportBuilder test validates ReportModel shape
- [ ] No test makes real network calls (all DNS/TLS mocked)
- [ ] `npm run build` in `packages/engine/` still exits 0

---

### P0-02 — @inboxshield/db Package Repair

**Objective:** Make `@inboxshield/db` importable by creating the missing `index.ts` entrypoint that exports a `PrismaClient` singleton, with proper Next.js hot-reload handling.

**Files expected to change/create:**
| Path | Action |
|---|---|
| `packages/db/src/index.ts` | Create: PrismaClient singleton export |
| `packages/db/package.json` | Modify: change `main` from `"index.ts"` to `"src/index.ts"` |

**Files that must NOT change:** `apps/*`, `packages/engine/*`, `packages/db/prisma/schema.prisma`, `packages/db/packages/*` (dead tree — addressed in P0-04)

**Prerequisites:** None

**Implementation steps:**
1. Create `packages/db/src/index.ts` with PrismaClient singleton pattern:
   ```ts
   import { PrismaClient } from '@prisma/client';

   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

   export const prisma = globalForPrisma.prisma ?? new PrismaClient();

   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

   export { PrismaClient };
   ```
   The `globalThis` caching prevents creating multiple PrismaClient instances during Next.js hot-reload (which re-executes module code on every file save).
2. Modify `packages/db/package.json`: change `"main": "index.ts"` to `"main": "src/index.ts"` (the file is now at `src/index.ts`, not root `index.ts`)
3. Verify importability: in a scratch script or via node REPL, confirm `require('@inboxshield/db')` resolves and exports `prisma` and `PrismaClient`

**Tests required:**
- Verification test: import `@inboxshield/db`, assert `prisma` is an instance of PrismaClient
- Singleton test: import twice, assert same object reference

**Validation commands:**
```bash
cd packages/db && node -e "const db = require('./src/index'); console.log(typeof db.prisma, typeof db.PrismaClient);"
cd packages/db && npm run build   # no-op but confirms package.json is valid
```

**Rollback criteria:** `git revert` the single commit; `main` reverts to `"index.ts"` (broken, as before).

**Commit message:** `fix: repair @inboxshield/db package entrypoint with PrismaClient singleton`

**Acceptance criteria:**
- [ ] `packages/db/src/index.ts` exists and exports `prisma` and `PrismaClient`
- [ ] `packages/db/package.json` main points to `"src/index.ts"`
- [ ] `node -e "require('./src/index')"` resolves without error
- [ ] Global singleton pattern present (NODE_ENV check)

---

### P0-03 — Database Migration Baseline

**Objective:** Generate the initial Prisma migration against the existing schema, establish the `.env` pattern, and validate the schema compiles against a real PostgreSQL instance.

**Files expected to change/create:**
| Path | Action |
|---|---|
| `packages/db/prisma/migrations/20260808_init/migration.sql` | Create: auto-generated by `prisma migrate dev` |
| `packages/db/prisma/migrations/migration_lock.toml` | Create: auto-generated |
| `packages/db/.env` | Document (do not commit — add to `.gitignore` if not already) |

**Files that must NOT change:** `apps/*`, `packages/engine/*`, application source code

**Prerequisites:** P0-02 (importable package); running PostgreSQL instance (local or Docker)

**Implementation steps — two paths, decided by PostgreSQL availability:**

*Primary path — a real PostgreSQL instance is available (local, Docker, or CI service):*
1. Provision a controlled local/test PostgreSQL instance; set `DATABASE_URL` in environment (or `packages/db/.env`)
2. Run `npx prisma migrate dev --name init` in `packages/db/` — generates the migration directory AND applies it to the instance
3. Verify the migration SQL matches the schema exactly (Workspace, Domain, ScanReport with correct fields and both indexes)
4. Run `npx prisma generate` and `npx prisma validate`
5. Document test database strategy: `DATABASE_URL_TEST` environment variable for a separate test database; `schema push` for the ephemeral test DB (faster than migration for tests)
6. Record in the commit message: `Migration applied and runtime-verified against PostgreSQL <version>`

*Fallback planning path — no PostgreSQL instance available:*
1. Generate deterministic migration SQL WITHOUT a live database using Prisma's schema-diff tooling:
   `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/20260808_init/migration.sql`
2. Add `prisma/migrations/migration_lock.toml` with `provider = "postgresql"` (created by hand; the diff tool does not emit it)
3. Run `npx prisma generate` and `npx prisma validate` (neither requires a live database connection)
4. Mark the unit outcome as **BLOCKED for runtime verification**: the migration SQL exists and is deterministic, but it was NOT applied against a real PostgreSQL instance
5. Record explicitly in the commit message and final report: `Migration NOT runtime-verified — BLOCKED until a PostgreSQL instance is available`

**Hard rule:** never claim a migration was runtime-verified against PostgreSQL when it was not. If the fallback path is used, the corresponding exit-criteria item remains open and the status must be reported as BLOCKED.

**Tests required:**
- Integration test (in P0-01 or P0-03): connect to test DB, run raw SQL to create a workspace + domain + scan report, verify roundtrip
- Schema validation: `prisma validate` exits 0

**Validation commands:**
```bash
# Primary path (real PostgreSQL):
cd packages/db && npx prisma migrate status  # reports "Database schema is up to date"
# Fallback path (no PostgreSQL):
cd packages/db && npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script   # deterministic SQL, exits 0
# Both paths:
cd packages/db && npx prisma validate       # exits 0
cd packages/db && npx prisma generate        # generates client
ls packages/db/prisma/migrations/            # migration directory exists
cat packages/db/prisma/migrations/20260808_init/migration.sql   # SQL matches schema
```

**Rollback criteria:** `git revert`; migration files removed; schema.prisma unchanged.

**Commit message:** `chore: establish Prisma migration baseline for InboxShield PostgreSQL schema`

**Acceptance criteria:**
- [ ] `packages/db/prisma/migrations/` contains the initial migration
- [ ] `npx prisma validate` exits 0
- [ ] `npx prisma generate` produces `node_modules/.prisma/client`
- [ ] Migration SQL contains all 3 models (Workspace, Domain, ScanReport) and both indexes
- [ ] EITHER (a) the migration was applied and runtime-verified against a real PostgreSQL instance, OR (b) the unit is explicitly reported as **BLOCKED for runtime verification** with no claim that it was applied
- [ ] The chosen path (primary or fallback) is recorded in the commit message — no fabricated verification claim

---

### P0-04 — Dead-Tree Classification, Migration, and Cleanup

**Objective:** Rescue the working `HistoryService` from the `packages/db` nested dead tree into the canonical persistence layer (`packages/db`), classify every dead-tree file, and remove the dead files.

**Ownership boundary (Correction 1):** `packages/engine` must remain framework-agnostic and persistence-agnostic. It may own scanner contracts, scanner execution, evidence/report models, scoring/rules, and orchestration. It must **NOT** own PrismaClient, PostgreSQL access, persistence repositories, or database CRUD. `HistoryService` performs direct Prisma persistence — it belongs in `packages/db`, the canonical persistence package, NOT in `packages/engine`. It is reusable persistence, not application-specific logic, so `packages/db` is preferred over `apps/web` or `apps/worker`.

**Dead tree exact paths (reconfirmed 2026-08-08):**

| Path | Classification | Action |
|---|---|---|
| `packages/db/prisma/schema.prisma` | **CANONICAL** | **KEEP** |
| `packages/db/package.json` | **FIXED (P0-02)** | **KEEP** |
| `packages/db/package-lock.json` | **STALE** | **DELETE** |
| `packages/db/packages/engine/src/services/history.service.ts` | **FUNCTIONAL — MIGRATE** | **MIGRATE** to `packages/db/src/services/history.service.ts` (canonical persistence layer) |
| `packages/db/packages/engine/src/index.ts` | **DEAD** (re-exports + HistoryService) | **DELETE** (after migration) |
| `packages/db/apps/worker/src/index.ts` | **DEAD** (older Fastify stub) | **DELETE** |
| `packages/db/docs/formal/16-Documentation-Completion-Summary.md` | **DEAD** (superseded variant doc) | **DELETE** |

**Migration target for HistoryService:**
The working Prisma `HistoryService` provides three methods that exist nowhere else in the canonical tree:
- `saveSnapshot(db, reportModel, workspaceId)` — persists `ReportModel` as immutable `ScanReport` JSON
- `getHistory(db, {workspaceId, limit, domainFilter, riskFilter})` — query with domain/risk filtering
- `getSnapshot(db, reportId, workspaceId)` — rehydrate a saved `ReportModel` by ID with workspace-scoping

These are the persistence primitives that Phase1 (SAAS_GAP `P-3`) requires. Moving them into the canonical tree now (P0-04) ensures the persistence logic exists before Phase1 needs it, and before the dead tree is deleted.

**Migration target:** `packages/db/src/services/history.service.ts` — the canonical persistence package. Dependency direction: `packages/db` may import types from `@inboxshield/engine` via `import type { ReportModel } from '@inboxshield/engine'` (type-only import, no runtime engine code runs in the persistence layer); `packages/engine` never imports `packages/db`. This keeps the dependency graph acyclic and the engine persistence-agnostic.

**Files expected to change/create:**
| Path | Action |
|---|---|
| `packages/db/src/services/history.service.ts` | **Create** (migrated from dead tree; adapted imports: `PrismaClient` from `@prisma/client`, `ReportModel` type-only from `@inboxshield/engine`) |
| `packages/db/package.json` | Modify: add `@inboxshield/engine` to dependencies (`"*"` — npm workspace resolution; used ONLY as `import type`, so no runtime engine code is pulled into the persistence layer) |
| `packages/db/packages/engine/src/services/history.service.ts` | **Delete** |
| `packages/db/packages/engine/src/index.ts` | **Delete** |
| `packages/db/apps/worker/src/index.ts` | **Delete** |
| `packages/db/docs/formal/16-Documentation-Completion-Summary.md` | **Delete** |
| `packages/db/package-lock.json` | **Delete** |

**Files that must NOT change:** `packages/db/prisma/schema.prisma`, `packages/engine/**` (no engine source file, no engine `package.json`), `apps/*`, scanner source files

**Prerequisites:** P0-01 (tests exist before moving code), P0-02 (db importable), P0-03 (migration baseline exists)

**Implementation steps:**
1. Create `packages/db/src/services/history.service.ts` with migrated logic:
   - Update import: `import { PrismaClient } from '@prisma/client'`
   - Update import: `import type { ReportModel } from '@inboxshield/engine'` (type-only — keeps the runtime persistence layer free of engine code)
   - Keep all three static methods unchanged (saveSnapshot, getHistory, getSnapshot)
2. Add `"@inboxshield/engine": "*"` to `packages/db/package.json` dependencies — required only so the `ReportModel` type resolves; confirm it is consumed as `import type` so no runtime engine code is pulled in
3. Verify the migrated service type-checks: `cd packages/db && npx tsc --noEmit`
4. Delete the 5 dead-tree files listed above
5. Verify `packages/db` tree is reduced to: `package.json`, `prisma/schema.prisma`, `prisma/migrations/` (from P0-03), `src/`

**Tests required:**
- Unit test for HistoryService methods: mock PrismaClient, test saveSnapshot creates domain if missing, getHistory filters correctly, getSnapshot returns null for wrong workspace
- Validation: `packages/db` dead-tree files are gone

**Validation commands:**
```bash
cd packages/db && npx tsc --noEmit           # HistoryService in packages/db type-checks
ls packages/db/packages/ 2>/dev/null || echo "DEAD_TREE_REMOVED"  # no nested packages/
ls packages/db/apps/ 2>/dev/null || echo "DEAD_TREE_REMOVED"      # no nested apps/
ls packages/db/docs/ 2>/dev/null || echo "DEAD_TREE_REMOVED"      # no nested docs/
ls packages/db/package-lock.json 2>/dev/null || echo "DELETED"
grep -rn "prisma\|PrismaClient" packages/engine/src || echo "ENGINE_HAS_NO_PERSISTENCE"
```

**Rollback criteria:** `git revert` restores all deleted files; HistoryService in engine is removed; engine package.json dep reverted.

**Commit message:** `chore: migrate HistoryService to canonical persistence layer (packages/db) and remove packages/db dead tree`

**Acceptance criteria:**
- [ ] `packages/db/src/services/history.service.ts` exists with all 3 methods
- [ ] `packages/db` type-checks (`npx tsc --noEmit`) with the migrated service
- [ ] `packages/engine` is untouched by this unit — no engine source change, no engine `package.json` change, no Prisma import anywhere in `packages/engine`
- [ ] `packages/db/packages/`, `packages/db/apps/`, `packages/db/docs/` directories are gone
- [ ] `packages/db/package-lock.json` is gone
- [ ] `packages/db` contains only: `package.json`, `prisma/schema.prisma`, `prisma/migrations/`, `src/`

---

### P0-05 — Type-Safety Enforcement

**Objective:** Remove `ignoreBuildErrors: true` from `next.config.ts`, surface and fix any resulting type errors, and make `typecheck` an explicit root validation gate.

**Current state confirmed:**
- `apps/web/next.config.ts` line6: `typescript: { ignoreBuildErrors: true }`
- `apps/web/tsconfig.json`: `strict: true`, `noEmit: true`, bundler module resolution
- Errors are in the Next.js build pipeline (not raw `tsc`); the strict tsconfig alone does not surface them because `next build` runs its own type checks

**Files expected to change/create:**
| Path | Action |
|---|---|
| `apps/web/next.config.ts` | Modify: remove the `typescript: { ignoreBuildErrors: true }` block |
| `apps/web/src/**/*.ts` / `apps/web/src/**/*.tsx` | Modify: fix any type errors surfaced by `next build` |
| `turbo.json` | Modify: add `"typecheck": { "dependsOn": ["^build"] }` task |

**Files that must NOT change:** `packages/engine/*`, `apps/worker/*` (only web is affected by `ignoreBuildErrors`)

**Prerequisites:** P0-01 (safety net before blast-radius change)

**Implementation steps:**
1. Remove the entire `typescript: { ignoreBuildErrors: true }` block from `apps/web/next.config.ts` (result: `nextConfig` has no `typescript` key)
2. Run `cd apps/web && npx next build` to surface errors
3. For each error: classify and fix (likely: missing type annotations on catch variables, `any` type warnings, component prop mismatches)
4. Repeat `next build` until it exits 0
5. Add `"typecheck": { "dependsOn": ["^build"] }` to `turbo.json` tasks (enables `turbo run typecheck` at root)
6. Run `npx turbo run typecheck` to verify the full monorepo type check passes

**Tests required:**
- `next build` exits 0 (the test is the build itself)
- `npx turbo run typecheck` exits 0

**Validation commands:**
```bash
cd apps/web && npx next build              # exits 0, no type errors
cd apps/web && grep -n ignoreBuildErrors next.config.ts || echo "REMOVED"  # not found
npx turbo run typecheck                    # all workspaces pass
```

**Rollback criteria:** `git revert`; `ignoreBuildErrors` restored; `turbo.json` typecheck task removed; all fixes reverted.

**Commit message:** `fix: enforce strict type safety by removing ignoreBuildErrors and fixing all surfaced errors`

**Acceptance criteria:**
- [ ] `next.config.ts` has no `ignoreBuildErrors` setting
- [ ] `next build` in `apps/web/` exits 0 with no type errors
- [ ] `turbo.json` has a `typecheck` task
- [ ] `npx turbo run typecheck` exits 0 across all workspaces
- [ ] No `any` types introduced (fixes are specific, not `as any` suppressions)

---

### P0-06 — Scanner Unification Plan and IP-RBL Migration

**Objective:** Document the behavioral comparison between `packages/engine` and `apps/worker` scanner sets, preserve the worker's unique IP-RBL blacklist logic by migrating it into the engine as a new `BaseScanner`, and establish contract tests that verify behavioral equivalence. Do NOT delete any worker scanner files in this unit (per Architecture Rule 3).

**Unique value identified in worker (not in engine):** Worker's `BlacklistScanner.checkIp()` checks IP addresses against 3 IP-based RBLs (`zen.spamhaus.org`, `b.barracudacentral.org`, `bl.spamcop.net`) using `Promise.allSettled`. The engine's `BlacklistScanner` only checks domain-based DBLs (`dbl.spamhaus.org`, `multi.surbl.org`). The IP-RBL capability is genuine additional functionality.

**Scanner comparison summary (for the unification report):**

| Scanner | Engine (canonical) | Worker | Unique value to preserve |
|---|---|---|---|
| DNS (A record) | DoH, framework-agnostic | node:dns/promises | Engine is strictly better (no DNS config needed) |
| SPF | DoH, RFC7208 multi-SPF, policy analysis | Static, simpler parse | Engine is strictly more thorough |
| DKIM | Auto-discovers 7 selectors, heuristic key-size | Requires explicit selector | Engine has auto-discovery (superior) |
| DMARC | DoH, full policy parse | Static, returns policy | Engine is more thorough |
| MX | DoH, null-MX detection | node:dns, no null-MX | Engine detects null-MX (superior) |
| SMTP TLS | TCP :25 EHLO → STARTTLS → tls.connect, cert validation | TCP :25 connect-only | Engine is strictly more thorough |
| Blacklist (domain) | dbl.spamhaus + multi.surbl | dbl.spamhaus only | Engine covers more domain DBLs |
| **Blacklist (IP)** | **MISSING** | **zen.spamhaus + barracuda + spamcop** | **Worker has unique IP-RBL — MIGRATE** |
| DNSSEC | N/A | Stub (always true) | Drop — no real implementation |
| SMTP (banner) | N/A | Connect-only | Drop — subsumed by engine TLS scanner |
| TLS (:443) | N/A | HTTPS cert, not SMTP | Drop — wrong port for email security |
| WHOIS | N/A | Stub (always true) | Drop — no real implementation |

**Files expected to change/create:**
| Path | Action |
|---|---|
| `packages/engine/src/scanners/ip-blacklist.scanner.ts` | **Create**: new `BaseScanner` implementing IP-RBL checks, migrated from worker |
| `packages/engine/src/scanners/ip-blacklist.scanner.test.ts` | **Create**: tests for the new scanner (mock DoHClient for RBL lookups) |
| `packages/engine/src/index.ts` | Modify: export `IpBlacklistScanner` |
| `docs/SCANNER_UNIFICATION_REPORT.md` | **Create**: full comparison table + rationale for each migration/drop decision |

**Files that must NOT change:** `apps/worker/src/scanners/*` (comparison only, no deletion), `packages/engine/src/scanners/{dns,spf,dkim,dmarc,mx,tls,blacklist}.scanner.ts` (existing scanners untouched)

**Prerequisites:** P0-01 (engine tests exist, new scanner gets tests), P0-06 is independent of DB work

**Implementation steps:**
1. Create `IpBlacklistScanner` implementing `BaseScanner`:
   - `id`: `'network:blacklist:ip'`
   - `description`: `'IP-based Real-time Blackhole List (RBL) check'`
   - `execute(domain)`: resolve domain A records via DoH → for each IP → check against RBL list (zen.spamhaus, barracuda, spamcop) using DoHClient → aggregate results
   - Uses `scoreWeight: 50` (matching domain blacklist weight)
   - Checks `Promise.allSettled` for individual RBL timeouts (graceful degradation)
2. Write `ip-blacklist.scanner.test.ts` mocking DoHClient:
   - IP listed on one RBL → `passed: false`, `flags` contains RBL name
   - IP clean → `passed: true`
   - DNS timeout on RBL → graceful degradation, does not throw
   - Invalid IP from A record → handled gracefully
3. Add `IpBlacklistScanner` export to `packages/engine/src/index.ts`
4. Write `docs/SCANNER_UNIFICATION_REPORT.md` with:
   - Full comparison table (as above)
   - Decision per scanner: keep engine / migrate / drop (with rationale)
   - Behavioral differences documented
   - Phase1 deprecation timeline for worker scanners (reference only, not implemented now)
5. Verify engine builds and all tests pass

**Tests required:**
- IpBlacklistScanner: 4+ test cases (listed, clean, timeout, invalid IP)
- Existing engine tests still pass after adding new scanner
- Orchestrator test confirms IpBlacklistScanner can be registered (if tested)

**Validation commands:**
```bash
cd packages/engine && npx vitest run       # all tests pass (including new scanner)
cd packages/engine && npm run build        # build succeeds, new export available
cat docs/SCANNER_UNIFICATION_REPORT.md     # document exists and is complete
```

**Rollback criteria:** `git revert`; new scanner file, test, export, and doc removed.

**Commit message:** `feat: migrate IP-RBL scanner to engine and establish scanner unification report`

**Acceptance criteria:**
- [ ] `IpBlacklistScanner` implements `BaseScanner`, has `id`, `description`, `execute`
- [ ] New scanner covered for: IP listed on an RBL (FAIL), clean IP (PASS), RBL lookup timeout (graceful degradation — ERROR, not a fabricated PASS/FAIL), and invalid/non-resolvable IP (handled without throw)
- [ ] `docs/SCANNER_UNIFICATION_REPORT.md` contains the comparison table and per-scanner decisions
- [ ] Engine build passes; no existing tests broken
- [ ] Worker scanner files are untouched

---

### P0-07 — Stub / Fabricated-Output Quarantine (truthful status states)

**Objective:** No component may silently fabricate either success OR failure. Unimplemented checks must report a truthful state — `UNSUPPORTED` / `NOT_IMPLEMENTED` with `passed: null` — never a fabricated `passed: true` or a fabricated `passed: false`. Real checks that run and fail report `FAIL` (`passed: false`); real checks that error report `ERROR` (`passed: null`). Partially-implemented checks (e.g., TCP connect-only SMTP with no banner analysis) must explicitly declare their scope — `passed: null` carries no overall verdict — so a partial result cannot be misread as a full validation verdict.

**Truthful status taxonomy (Correction 2):**

`passed` is `boolean | null`. It is `true` **only** for a definitive `PASS`, `false` **only** for a definitive `FAIL`, and `null` for every state with no definitive factual PASS/FAIL verdict. `passed` never carries a fabricated boolean.

| State | Meaning | `passed` value |
|---|---|---|
| `PASS` | A real check executed and passed | `true` |
| `FAIL` | A real check executed and failed | `false` |
| `ERROR` | A real check executed but errored (timeout, network failure) | `null` (no verdict) + `error` |
| `UNSUPPORTED` / `NOT_IMPLEMENTED` | The check was **not** executed — the feature is not implemented | `null` (no verdict) + explicit `status` + `error` |
| `DISABLED` | The check is intentionally disabled (e.g., removed from a pipeline) | `null` (no verdict) |
| `PARTIAL` (permitted extension) | Only part of the check ran (e.g., TCP port-25 reachability only, no SMTP banner analysis) | `null` (no overall verdict); the executed sub-check's truth lives in `status`/`error`/scope note, never in `passed` |

**Contract change required (smallest):** the worker scanners currently return inline object types with a boolean-only `passed` field (`{ passed: boolean; ... }`), which cannot represent `UNSUPPORTED`, `ERROR`, `DISABLED`, or `PARTIAL` truthfully. The smallest contract change is to widen `passed` to `boolean | null`:
1. Create `apps/worker/src/scanners/types.ts` exporting:
   - `ScanStatus = 'PASS' | 'FAIL' | 'ERROR' | 'UNSUPPORTED' | 'DISABLED' | 'PARTIAL'`
   - `ScannerResult` interface with `passed: boolean | null; status: ScanStatus; error?: string; ...` (extended per scanner as needed)
2. Invariant (enforced by design): `passed` is `true` **only** when `status` is `PASS`, `false` **only** when `status` is `FAIL`, and `null` for `ERROR`, `UNSUPPORTED`, `DISABLED`, and `PARTIAL` — no definitive verdict, so `passed` must never carry a fabricated boolean; the truthful meaning lives in `status` + `error`
3. Apply the status field to the stubs in this unit; the other worker scanners (which perform real checks) adopt the field when they are next touched — rewriting all 10 scanners is not required in Phase 0

**Stub inventory and classification:**

| Component | Current behavior | Classification | Phase 0 action |
|---|---|---|---|
| `apps/worker/src/scanners/dnssec.scanner.ts` | `{ passed: true }` fabricated | **UNSUPPORTED** | `{ status: 'UNSUPPORTED', passed: null, error: 'DNSSEC validation not implemented — requires DNSKEY/AD-flag resolution (not supported by node:dns)' }` — `passed` is `null` (no verdict); `status` carries the truth |
| `apps/worker/src/scanners/whois.scanner.ts` | `{ passed: true, ageDays: 365 }` fabricated | **UNSUPPORTED** | `{ status: 'UNSUPPORTED', passed: null, ageDays: null, error: 'WHOIS lookup not implemented — requires external API dependency' }` — no fabricated `365` age; no fabricated boolean |
| `apps/worker/src/scanners/smtp.scanner.ts` | TCP :25 connect-only; JSDoc claims "banner grab" that never runs | **PARTIAL** (reachability check is real; banner analysis is not) | Keep the real port-25 reachability check (its truth lives in `status`/`rawData`/scope note) but: set `status: 'PARTIAL'`, set `passed: null` (no overall SMTP verdict — the check is incomplete), update JSDoc to state explicitly that SMTP banner/EHLO analysis is NOT implemented — the result must never be read as full SMTP validation |
| `apps/worker/src/api/reports.ts` | Returns hardcoded CSV string and fake `Buffer.from("%PDF-1.4...")` | **NOT_IMPLEMENTED** | Replace both methods to `throw new Error('Report export not implemented')` — explicit `NOT_IMPLEMENTED` error, never a fabricated file |
| `apps/web/src/app/page.tsx` | Hardcoded `84/100`, hardcoded domains/incidents | **DISABLED (demo)** | Add a visible `"Demo data — not connected to live scan results"` label; demo values must never be presented as real scan results |
| `apps/worker/src/queue/webhook.worker.ts` | Logs + `sleep(50)`, does nothing | **DISABLED (stub)** | Leave for Phase1 worker implementation; it already makes no fabrication claim |

**Files expected to change:**
| Path | Action |
|---|---|
| `apps/worker/src/scanners/types.ts` | **Create**: `ScanStatus` union + `ScannerResult` interface — the minimal contract change required to represent truthful status |
| `apps/worker/src/scanners/dnssec.scanner.ts` | Modify: return `status: 'UNSUPPORTED'`, `passed: null` with explicit error — no fabricated boolean verdict |
| `apps/worker/src/scanners/whois.scanner.ts` | Modify: return `status: 'UNSUPPORTED'` with no fabricated `ageDays` |
| `apps/worker/src/scanners/smtp.scanner.ts` | Modify: add `status` field, update JSDoc with explicit scope note (banner analysis NOT implemented), keep real connect check |
| `apps/worker/src/api/reports.ts` | Modify: `exportToCSV` and `generatePDFSummary` throw `Error('Report export not implemented')` — NOT_IMPLEMENTED, never a scan verdict |
| `apps/web/src/app/page.tsx` | Modify: add a visible demo-data disclaimer near the score display |

**Files that must NOT change:** `packages/engine/**` (engine has no fabricated stubs — DNSSEC/WHOIS are worker-only), `apps/web/src/app/api/scan/route.ts`

**Prerequisites:** P0-01 (tests exist; no worker test infra yet, so validation is manual + build-based)

**Implementation steps:**
1. Create `apps/worker/src/scanners/types.ts` with `ScanStatus` union and `ScannerResult` interface
2. Modify `dnssec.scanner.ts`: return `{ status: 'UNSUPPORTED', passed: null, error: 'DNSSEC validation not implemented — requires DNSKEY/AD-flag resolution (not supported by node:dns)' }` — `passed` is `null` (no verdict); the truthful meaning is carried by `status`
3. Modify `whois.scanner.ts`: return `{ status: 'UNSUPPORTED', passed: null, ageDays: null, error: 'WHOIS lookup not implemented — requires external API dependency' }` — no fabricated `365`; no fabricated boolean
4. Modify `smtp.scanner.ts`: add `status: 'PARTIAL'` and `passed: null` to the real TCP connect result (no overall verdict; reachability truth lives in `status`/`rawData`/scope note); update the JSDoc to state explicitly that SMTP banner/EHLO analysis is NOT implemented — the result covers port-25 reachability only, not full SMTP validation
5. Modify `reports.ts`: replace both `exportToCSV` and `generatePDFSummary` method bodies with `throw new Error('Report export not implemented')`
6. Modify `page.tsx`: add a visible disclaimer element near the "84/100" score reading: `"Demo data — not connected to live scan results"`
7. Verify builds: `cd apps/worker && npm run build && cd apps/web && npx next build`

**Tests required:**
- Manual validation (worker test infra does not exist yet): confirm DNSSEC returns `status: 'UNSUPPORTED'`, WHOIS returns `status: 'UNSUPPORTED'` with `ageDays: null`, SMTP returns real connect result with `status: 'PARTIAL'`, reports throw `NOT_IMPLEMENTED`, dashboard shows disclaimer
- `apps/worker` build succeeds (type-checks with the new `ScannerResult` fields)
- `apps/web` build succeeds
- No fabricated `passed: true` or `passed: false` anywhere in modified stub files; every UNSUPPORTED stub returns `passed: null` (grep verification)

**Validation commands:**
```bash
cd apps/worker && npm run build            # worker compiles with ScanStatus contract
cd apps/web && npx next build              # web compiles with disclaimer
grep -n "UNSUPPORTED" apps/worker/src/scanners/dnssec.scanner.ts    # truthful status, not fabricated
grep -n "UNSUPPORTED" apps/worker/src/scanners/whois.scanner.ts     # truthful status, no fabricated age
grep -n "status" apps/worker/src/scanners/smtp.scanner.ts           # PARTIAL scope present
grep -n "not implemented" apps/worker/src/api/reports.ts            # NOT_IMPLEMENTED, not fake data
grep -n "Demo data" apps/web/src/app/page.tsx                       # disclaimer visible
grep -n "passed: true" apps/worker/src/scanners/dnssec.scanner.ts apps/worker/src/scanners/whois.scanner.ts || echo "NO_FABRICATED_PASS"
grep -n "passed: false" apps/worker/src/scanners/dnssec.scanner.ts apps/worker/src/scanners/whois.scanner.ts || echo "NO_FABRICATED_FAIL"
grep -n "passed: null" apps/worker/src/scanners/dnssec.scanner.ts apps/worker/src/scanners/whois.scanner.ts  # null verdict present
```

**Rollback criteria:** `git revert`; all stubs and the types file return to their pre-edit state.

**Commit message:** `fix: quarantine fabricated stub outputs — DNSSEC/WHOIS report UNSUPPORTED, reports throw NOT_IMPLEMENTED, SMTP scoped PARTIAL, dashboard labeled demo`

**Acceptance criteria:**
- [ ] `apps/worker/src/scanners/types.ts` defines `ScanStatus` and `ScannerResult`; both stub returns conform to the contract
- [ ] `dnssec.scanner.ts` returns `status: 'UNSUPPORTED'` with `passed: null` — no fabricated boolean
- [ ] `whois.scanner.ts` returns `status: 'UNSUPPORTED'` with `passed: null` and no fabricated `ageDays: 365`
- [ ] `smtp.scanner.ts` reports real reachability truthfully with `status: 'PARTIAL'`, `passed: null`, and an explicit scope note; SMTP banner analysis is never implied
- [ ] `reports.ts` methods throw `NOT_IMPLEMENTED` errors — never return a fabricated buffer or CSV string
- [ ] Dashboard shows a visible "Demo data" disclaimer — hardcoded values are never presented as real scan results
- [ ] Unexecuted checks return `passed: null` — never a fabricated `passed: true` or `passed: false`
- [ ] Worker and web builds pass

---

### P0-08 — /api/scan Security Hardening

**Objective:** Add minimum security protections to the only live, unauthenticated endpoint in the application, without implementing full SaaS auth (Phase1).

**Current state confirmed (from `apps/web/src/app/api/scan/route.ts`):**
```ts
export async function POST(req: Request) {
  const { domain } = await req.json();
  if (!domain) { return NextResponse.json({ error: 'Domain is required' }, { status: 400 }); }
  const report = await orchestrator.analyzeDomain(domain);
  const recommendations = await aiProvider.analyze(report);
  return NextResponse.json({ report, recommendations });
  // catch: leaks error.message in 500 response
}
```

**Problems:** No domain format validation, no SSRF defense (private IPs, localhost), no request size limit, no rate limiting, no timeout on total request (only per-scanner 5s timeout), leaks raw `Error.message` to client, no auth.

**Files expected to change/create:**
| Path | Action |
|---|---|
| `apps/web/src/lib/domain-validator.ts` | **Create**: domain validation + normalization + SSRF check utility |
| `apps/web/src/lib/rate-limit.ts` | **Create**: `RateLimiter` interface + `LocalMemoryRateLimiter` (dev-only) — production boundary documented |
| `apps/web/src/app/api/scan/route.ts` | Modify: integrate validator, add safe error responses, add timeout wrapper, wire rate limiter via interface |

**Files that must NOT change:** `packages/engine/*`, `apps/worker/*`, `apps/web/src/app/page.tsx`

**Prerequisites:** P0-01 (route tests), P0-05 (type safety enforced)

**Implementation steps:**
1. Create `apps/web/src/lib/domain-validator.ts` exporting:
   - `normalizeDomain(input: string): string` — lowercase, trim whitespace, remove trailing dot, validate against RFC-compliant hostname regex (alphanumeric + hyphens + dots, 2-63 chars per label, total ≤ 253 chars, must have valid TLD)
   - `isPrivateOrReservedIP(domain: string): Promise<boolean>` — resolve A records via DoHClient (from `@inboxshield/engine`), check if any resolved IP falls in RFC1918/127.0.0.0/8/::1/169.254.0.0/16/10.0.0.0/8/172.16.0.0/12/192.168.0.0/16 ranges; return true if so → block scan
   - `validateDomainInput(raw: string): { valid: true, normalized: string } | { valid: false, error: string }`
2. Modify `route.ts` (validation, SSRF, timeout, safe errors):
   - Import `validateDomainInput`, `isPrivateOrReservedIP` from `@/lib/domain-validator`
   - Replace `if (!domain)` with `const validation = validateDomainInput(domain); if (!validation.valid) return 400 with validation.error`
   - After normalization: check `isPrivateOrReservedIP` → if true, return 400 with "Domain resolves to private/reserved IP"
   - Add `AbortSignal.timeout(30_000)` to `orchestrator.analyzeDomain(domain)` call (total 30s timeout for the entire scan, since per-scanner timeout is 5s × 7 scanners = 35s theoretical max)
   - In catch block: return generic `500: "Scan failed"` — never leak `error.message`
3. Create `apps/web/src/lib/rate-limit.ts`:
   - `interface RateLimiter { check(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number; remaining?: number }> }`
   - `LocalMemoryRateLimiter implements RateLimiter` — in-process `Map`, per normalized domain, 10 requests/min/domain, resets on process restart
   - **Documented production boundary:** the `RedisRateLimiter` implementation (same `RateLimiter` interface, Redis-backed via INCR + EXPIRE or BullMQ's Redis) is the production-deployment target for Phase1. The local in-memory implementation is explicitly **single-process, non-persistent, and NOT production protection** — this limitation must appear as a code comment in `rate-limit.ts` and be noted in the route handler
4. Wire the rate limiter into `route.ts` via the `RateLimiter` interface (inject `LocalMemoryRateLimiter` for dev): the route must import the **interface**, not the concrete class, so swapping to `RedisRateLimiter` later is a one-line dependency change. Return `X-RateLimit-Remaining` header; `429` with `Retry-After` when `check()` returns `allowed: false`
5. Add unit tests:
   - `apps/web/src/lib/domain-validator.test.ts`: behavior-based — valid domains accepted; empty / localhost / IP-address / malformed hostnames rejected; private/reserved IP ranges blocked
   - `apps/web/src/lib/rate-limit.test.ts`: `LocalMemoryRateLimiter` allows requests within budget, then blocks with `allowed: false` and `retryAfter` after the budget is exhausted; keys are independent per domain

**Tests required:**
- `domain-validator.test.ts`: behavior-based — valid domains accepted; empty / localhost / IP-address / malformed hostnames rejected; private/reserved IP ranges blocked
- `rate-limit.test.ts`: behavior-based — budget-then-block semantics (allowed → allowed → ... → `allowed: false` + `retryAfter`); keys independent per domain; interface contract satisfied
- Manual verification: POST to `/api/scan` with `{ "domain": "192.168.1.1" }` → 400
- Manual verification: POST to `/api/scan` with `{ "domain": "" }` → 400
- Manual verification: rate limit triggers 429 after per-domain budget exhaustion

**Validation commands:**
```bash
cd apps/web && npx next build                    # build succeeds
cd apps/web && npx vitest run                    # domain validator tests pass
grep -n "error.message" apps/web/src/app/api/scan/route.ts || echo "NO_ERROR_LEAK"  # no raw error.message in response
grep -n "AbortSignal.timeout" apps/web/src/app/api/scan/route.ts                    # timeout present
grep -n "429" apps/web/src/app/api/scan/route.ts                                     # rate limit present
```

**Rollback criteria:** `git revert`; route returns to original unprotected state.

**Commit message:** `fix: harden /api/scan with domain validation, SSRF defense, rate limiting, and safe error responses`

**Acceptance criteria:**
- [ ] `validateDomainInput` rejects: empty, localhost, IP addresses, malformed hostnames
- [ ] `isPrivateOrReservedIP` blocks RFC1918/loopback/link-local ranges
- [ ] `route.ts` has `AbortSignal.timeout(30_000)` on the scan call
- [ ] 500 responses return generic message, not `error.message`
- [ ] `RateLimiter` interface exists in `rate-limit.ts`; route depends on the interface, not the in-memory concrete class
- [ ] `LocalMemoryRateLimiter` is explicitly documented (code comment + contract) as single-process / dev-only / **NOT production protection**
- [ ] Redis-backed `RedisRateLimiter` production-deployment boundary is documented as the Phase1 target (the interface is already compatible)
- [ ] Rate limit returns 429 with `Retry-After` header after the per-domain budget is exhausted
- [ ] `next build` exits 0

---

### P0-09 — Deterministic Evidence Contracts

**Objective:** Formalize the invariant that one `ScanReport.id` maps to one immutable `ReportModel` snapshot. Freeze the evidence type contract so that Phase1 persistence writes and Phase1 reads use identical shapes, and so that `rawData` inside `ScannerResult` is never mutated after creation.

**Current state:**
- `ScannerResult.rawData` is typed as `unknown` — arbitrary per-scanner data
- `ReportModel` (in `packages/engine/src/report/types.ts`) has no version field
- `ScanReport.reportModel` (Prisma schema) is `Json` — no schema validation at the DB layer
- No contract tests assert the shape of `ScannerResult` or `ReportModel`

**Files expected to change/create:**
| Path | Action |
|---|---|
| `packages/engine/src/report/types.ts` | Modify: add `version: string` to `ReportModel.metadata`, add JSDoc immutability comment to `ScannerResult.rawData` |
| `packages/engine/src/core/types.ts` | Modify: add JSDoc `@immutable` annotation to `ScannerResult.rawData`; change `passed: boolean` → `passed: boolean | null` (contract correction — `null` when no definitive verdict: ERROR/UNSUPPORTED/DISABLED/PARTIAL) |
| `packages/engine/src/core/types.test.ts` | **Create**: contract tests asserting shape invariants |
| `packages/engine/src/report/types.test.ts` | **Create**: contract tests for ReportModel shape |

**Files that must NOT change:** `apps/*`, `packages/db/prisma/schema.prisma`, scanner source files

**Prerequisites:** P0-01 (engine test infrastructure exists)

**Implementation steps:**
1. Add `version: string` to `ReportModel.metadata` in `types.ts` (value: `'1.0.0'` — versioned evidence contract)
2. Update `ReportBuilder.build()` in `packages/engine/src/report/builder.ts` to set `metadata.version: '1.0.0'` in the output
3. Add `@immutable Once created by a scanner, rawData must not be mutated. Copy before modifying.` JSDoc to `ScannerResult.rawData`
   - In the same file: change `ScannerResult.passed` from `boolean` to `boolean | null` (ERROR/UNSUPPORTED/DISABLED/PARTIAL carry `null`; only PASS returns `true`, only FAIL returns `false`). Update safeExecute fault result in `orchestrator.ts` to return `passed: null` (not `false`) + `SCANNER_FAULT`.
4. Create `types.test.ts` contracts:
   - `ScannerResult` has required fields: `scannerId (string)`, `passed (boolean | null)`, `scoreWeight (number)`, `rawData (unknown)`, `flags (Array<string>)`
   - `EngineReport` has: `domain (string)`, `timestamp (string)`, `globalScore (number)`, `riskLevel (LOW|MEDIUM|HIGH|CRITICAL)`, `scannerResults (Record<string, ScannerResult>)`
5. Create `report/types.test.ts` contracts:
   - `ReportModel` has: `metadata.domain`, `metadata.generatedAt`, `metadata.version === '1.0.0'`
   - `executiveSummary.score` is a number, `riskLevel` is valid enum, `statusText` is string
   - `authentication` and `infrastructure` are arrays of `PresentationSection` shape
   - `recommendations` is array of objects with `title` and `description`
6. Run all engine tests to verify

**Tests required (behavior-based):**
- `ScannerResult` shape contract: required fields present and correctly typed (scannerId, `passed: boolean | null`, scoreWeight, rawData, flags)
- `EngineReport` shape contract: required fields present and correctly typed (domain, timestamp, globalScore, riskLevel, scannerResults)
- `ReportModel` shape contract: metadata domain/generatedAt/version, section arrays, recommendations — including `version === '1.0.0'`
- Failure path: a report missing `version` (or other required fields) fails the contract test
- Builder test (from P0-01) still passes (it now gets `version` in metadata)

**Validation commands:**
```bash
cd packages/engine && npx vitest run       # all tests pass
grep -n "version" packages/engine/src/report/types.ts        # version field present
grep -n "1.0.0" packages/engine/src/report/builder.ts        # version set in builder
```

**Rollback criteria:** `git revert`; version field removed; contract tests removed.

**Commit message:** `feat: freeze deterministic evidence contract with versioned ReportModel and shape tests`

**Acceptance criteria:**
- [ ] `ReportModel.metadata` includes `version: string`
- [ ] `ReportBuilder.build()` outputs `metadata.version === '1.0.0'`
- [ ] `ScannerResult.rawData` has `@immutable` JSDoc
- [ ] Contract tests assert all required fields on `ScannerResult`, `EngineReport`, and `ReportModel`
- [ ] `metadata.version` contract test passes
- [ ] All existing engine tests still pass

---

### P0-10 — CI Validation Gates

**Objective:** Create a GitHub Actions CI workflow that runs all validation gates on every PR and push to `main`, preventing broken code from being committed.

**Files expected to change/create:**
| Path | Action |
|---|---|
| `.github/workflows/ci.yml` | **Create**: CI workflow with all gates |

**Files that must NOT change:** any application source code

**Prerequisites:** All prior P0 units must be complete (P0-01 through P0-09); gates must pass locally before the workflow is committed

**Implementation steps:**
1. Create `.github/workflows/ci.yml` with the following job:
   - **Trigger:** `push` to `main` + `pull_request` to `main`
   - **Node version:** 20 (matching `engines.node >= 20` in root `package.json`)
   - **Services:** PostgreSQL 15 (for `prisma validate` and `prisma generate`)
   - **Steps:**
     1. `actions/checkout@v4`
     2. `actions/setup-node@v4` with node-version 20 and npm cache
     3. `npm ci` (clean install, no package-lock drift)
     4. `npm audit --audit-level=high` (fail on high/critical vulnerabilities)
     5. `npx prisma generate` in `packages/db/` (generate Prisma client)
     6. `npx prisma validate` in `packages/db/` (schema validity)
     7. `npx turbo run build` (all workspaces build)
     8. `npx turbo run lint` (all workspaces lint)
     9. `npx turbo run typecheck` (all workspaces type check)
     10. `npx turbo run test` (all workspaces test — only engine has tests in Phase0)
   - **Environment variables:** `DATABASE_URL` for Prisma (point to the PostgreSQL service)
   - **No deployment or release steps** — CI only, not CD

**Tests required:**
- The workflow file itself is the test: it must parse as valid YAML and execute locally via `act` or on GitHub

**Validation commands (before committing):**
```bash
# Verify all gates pass locally first:
npm ci
npm audit --audit-level=high
npx prisma generate   # in packages/db
npx prisma validate   # in packages/db
npx turbo run build
npx turbo run lint
npx turbo run typecheck
npx turbo run test

# Then verify the workflow file:
cat .github/workflows/ci.yml   # valid YAML, all steps present
```

**Rollback criteria:** `git revert`; workflow file removed.

**Commit message:** `ci: add GitHub Actions validation gates for build, lint, typecheck, test, and Prisma`

**Acceptance criteria:**
- [ ] `.github/workflows/ci.yml` exists
- [ ] All 10 validation steps are present in the workflow
- [ ] Workflow triggers on push to main and PRs to main
- [ ] PostgreSQL service is configured for Prisma
- [ ] `npm audit --audit-level=high` is a gate (not advisory)
- [ ] `npx turbo run test` is a gate (runs engine tests)
- [ ] No deployment/release steps exist (CI only)

---

## 6. Testing Strategy

### 6.1 Framework and tooling

| Component | Choice | Config path |
|---|---|---|
| Test runner | Vitest | `packages/engine/vitest.config.ts` |
| Mocking | `vi.mock()` (module-level) | Per test file |
| API testing | Native `fetch` + Vitest (Next.js route handlers accept `Request`) | `apps/web/src/lib/domain-validator.test.ts` |
| Assertion library | Vitest's built-in (`describe/it/expect`) | No extra dependency |

### 6.2 Mock strategy for scanner tests

Every engine scanner makes outbound DNS calls (DoH or node:dns). Tests must be deterministic and network-free.

**Mock target:** `DoHClient` — the DoH abstraction used by 5 of 7 scanners (DNS, SPF, DKIM, DMARC, MX). Blacklist and TLS scanners use `node:dns/promises` directly and must be mocked separately.

**Mock pattern:**
```ts
vi.mock('../utils/doh.client', () => ({
  DoHClient: {
    resolve: vi.fn().mockResolvedValue([{ type: 'TXT', name: '...', data: 'v=spf1 ...' }]),
    query: vi.fn().mockResolvedValue([{ type: 'A', name: '...', data: '1.2.3.4' }]),
  }
}));
```

Each scanner test file provides a **custom mock factory** returning the specific DNS records that scanner queries for, avoiding cross-test pollution.

For the blacklist scanner (node:dns, not DoH): mock `node:dns/promises` with `vi.mock('node:dns/promises', ...)`.

For the TLS scanner (raw TCP + TLS): mock `net.createConnection` and `tls.connect` with `vi.mock('net', ...)` and `vi.mock('tls', ...)`.

### 6.3 Scanner contract tests (generic)

A reusable test utility that verifies any `BaseScanner` implementation:
- `scanner.id` is a non-empty string
- `scanner.description` is a non-empty string
- `scanner.execute(domain)` returns an object with `scannerId`, `passed`, `scoreWeight`, `rawData`, `flags` (all correct types)
- This runs against every scanner in the engine (parametric test via `describe.each`)

### 6.4 Test database strategy

| Concern | Approach |
|---|---|
| Prisma migration testing | `prisma validate` (schema-only, no DB needed) |
| Prisma integration tests | Separate `DATABASE_URL_TEST` pointing to an ephemeral DB; `prisma db push` (fast, no migration files) before each test run |
| Test isolation | Each test creates and cleans up its own workspace/domain/scanreport rows; `beforeAll` seeds, `afterAll` truncates |
| CI test DB | GitHub Actions PostgreSQL service container (same `DATABASE_URL_TEST` pattern) |

### 6.5 Coverage requirements (behavior-based)

Test acceptance is **behavior-based, not count-based**. Each unit's "Tests required" section defines the behaviors that must be covered (success, failure, and malformed/error paths). Test counts are reported **after implementation** for observability only — they are never an acceptance gate, and never planned upfront.

| Unit | Behaviors that must be covered |
|---|---|
| P0-01 engine scanner tests | Each of the 7 scanners: valid-record path, missing/invalid-record path, and malformed DNS/network-response path |
| P0-01 orchestrator tests | Single scanner, multiple scanners, scanner throws (safeExecute), score calculation, risk thresholds, empty scanner set |
| P0-01 HeuristicAiProvider tests | All flag combinations (healthy, unhealthy, partial) |
| P0-01 ReportBuilder tests | Valid report + recommendations, report with errors, empty recommendations |
| P0-02 db singleton test | Singleton returns same instance; importable from `@inboxshield/db` |
| P0-04 HistoryService tests | saveSnapshot, getHistory, getSnapshot — success and failure paths |
| P0-06 IpBlacklistScanner tests | Listed IP, clean IP, RBL timeout, invalid IP |
| P0-08 domain validator tests | Valid, empty, localhost, IP address, malformed hostname; SSRF block; rate-limit trigger |
| P0-09 evidence contract tests | ScannerResult/EngineReport/ReportModel required shapes; version field; failure when version missing |

**Counts reported post-implementation only:** each unit records the number of tests and assertions actually written. No count is a target; a count is a report.

---

## 7. Database Strategy

### 7.1 Package repair (P0-02)

The `@inboxshield/db` package currently has `"main": "index.ts"` pointing to a nonexistent file. The fix creates `packages/db/src/index.ts` exporting a PrismaClient singleton with `globalThis` caching for Next.js hot-reload safety. The `main` field is updated to `"src/index.ts"`.

### 7.2 Schema and migration (P0-03)

The existing schema (`Workspace → Domain → ScanReport`) is sound and unchanged. An initial migration is generated via `prisma migrate dev --name init`. The schema's `reportModel Json` column stores the full `ReportModel` JSON from the engine's `ReportBuilder` — this is the immutable evidence snapshot that Phase1 persistence writes.

### 7.3 Environment pattern

```
DATABASE_URL=postgresql://user:password@localhost:5432/inboxshield?schema=public      # development
DATABASE_URL_TEST=postgresql://user:password@localhost:5432/inboxshield_test?schema=public  # testing
```

The test database is separate and can be wiped/recreated via `prisma db push` without affecting development data.

### 7.4 Worker DB consumption (deferred)

The worker currently makes zero DB queries. In Phase1 (after P0-02 through P0-04), the worker will import `@inboxshield/db` and use the PrismaClient singleton to write `ScanReport` rows. Phase0 makes this possible by making the package importable and the schema migrated — the actual write path is Phase1 work.

---

## 8. Scanner Unification Strategy

### 8.1 Phase 0 scope (P0-06)

Phase0 establishes the **unification plan and preserves unique behavior** — it does NOT delete worker scanners.

**In Phase0:**
- Document the behavioral comparison (`docs/SCANNER_UNIFICATION_REPORT.md`)
- Migrate the IP-RBL scanner (unique worker value) into engine as `IpBlacklistScanner`
- Do NOT delete any worker scanner file

### 8.2 Phase1 scope (deferred)

Phase1 will:
1. Replace the worker's `ScoringEngine` with calls to `@inboxshield/engine`'s `EngineOrchestrator`
2. Wire the worker to import and use the canonical engine's scanners
3. Remove the worker's independent scanner files (after Phase0 comparison tests document any behavioral gaps)
4. Unify scoring on the engine's `100 − Σ(weights)` formula

### 8.3 Canonical scanner set (post-Phase0)

```
packages/engine:
  1. network:dns:a_record         (existing)
  2. auth:spf                     (existing)
  3. auth:dkim                    (existing)
  4. auth:dmarc                   (existing)
  5. network:mx                   (existing)
  6. network:smtp:tls             (existing)
  7. network:blacklist:domain     (existing)
  8. network:blacklist:ip         (NEW in P0-06 — migrated from worker)
```

---

## 9. Security Baseline (P0-08)

| Protection | Implementation | Verified by |
|---|---|---|
| Domain format validation | RFC-compliant hostname regex, max 253 chars, valid TLD | Unit tests (10+ cases) |
| Normalization | Lowercase, trim, trailing dot removal | Unit tests |
| SSRF defense | Resolve A records, block RFC1918/loopback/link-local ranges | Unit tests + manual |
| Request size | `req.json()` failure caught (JSON parse error) → 400 | Implicit |
| Rate limiting | `RateLimiter` interface; `LocalMemoryRateLimiter` (dev-only, per-domain token bucket 10 req/min/domain), 429 + Retry-After; Redis-backed implementation documented as the production-deployment target | Unit test + manual verification |
| Timeout | `AbortSignal.timeout(30_000)` on entire scan | Code review |
| Safe errors | 500 returns generic message only; `error.message` never leaked | Code review (grep) |
| Auth boundary preparation | Route handler validates domain first, auth check can be inserted before scan (Phase1) | Structural — no auth added in Phase0 |

---

## 10. Stub / Fabricated-Output Policy

| Component | Phase 0 action | Rationale |
|---|---|---|
| DNSSEC (worker) | **QUARANTINE → UNSUPPORTED**: `status: 'UNSUPPORTED'`, `passed: null`, explicit error; no fabricated verdict | Fabricated `passed: true` is a security lie; `passed: false` would be a fabricated failure — `status` carries the truth; `passed: null` = no verdict |
| WHOIS (worker) | **QUARANTINE → UNSUPPORTED**: `status: 'UNSUPPORTED'`, `passed: null`, `ageDays: null`, explicit error; no fabricated number | Fabricated `365 days` is a data lie; `ageDays: 0` would be a fabricated number — `status` carries the truth; `passed: null` = no verdict |
| SMTP (worker) | **PARTIAL**: add `status: 'PARTIAL'`, keep the real TCP-connect result, update JSDoc to state banner/EHLO analysis is NOT implemented | Reachability check is real and truthful; unexecuted banner analysis is labelled, never implied |
| PDF export (worker) | **UNSUPPORTED**: throw `Error('PDF export not implemented')` | `Buffer.from("%PDF-1.4...")` is a fake file |
| CSV export (worker) | **UNSUPPORTED**: throw `Error('CSV export not implemented')` | Hardcoded CSV is fake data |
| Dashboard constants (web) | **MOVE TO LATER**: add disclaimer label | Not a fabricated pass — it's demo data, but must be labeled |
| Webhook worker (worker) | **MOVE TO LATER**: leave as-is | Not fabricated — it honestly does nothing and doesn't claim to |

---

## 11. CI Gates (P0-10)

```
npm ci                              # clean install — no lockfile drift
npm audit --audit-level=high        # fail on high/critical CVEs
npx prisma generate                 # generate PrismaClient
npx prisma validate                 # schema validity (requires DATABASE_URL)
npx turbo run build                 # all workspaces compile
npx turbo run lint                  # all workspaces pass ESLint
npx turbo run typecheck             # all workspaces pass TypeScript strict
npx turbo run test                  # all workspace tests pass
```

All gates must pass for a PR to be mergeable. No gate is advisory-only.

---

## 12. Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| `next build` produces many type errors after removing `ignoreBuildErrors` | High — P0-05 could be large | Medium | Run `next build` immediately in P0-05 step 2; if >20 files need changes, revert and investigate in a separate session before proceeding |
| HistoryService migration breaks due to import path changes | Medium — P0-04 fails | Low | The migration is mechanical (3 import paths); test with `npm run build` immediately |
| DoH mock strategy doesn't cover all DNS call patterns | Medium — scanner tests are incomplete | Low | Audit each scanner's DNS call pattern before writing mocks; blacklist scanner uses `node:dns` directly — mock separately |
| In-memory rate limiter state leaks across tests | Low — false 429 in tests | Low | Clear rate limit Map in `beforeEach`; or use a fresh handler instance per test |
| Worker build breaks after stub changes (P0-07) | Low — worker stub changes are minimal | Low | Worker has no test infra; verify with `npm run build` |
| GitHub Actions PostgreSQL service needs DATABASE_URL format alignment | Low — CI fails on first run | Low | Use standard `postgresql://postgres:postgres@localhost:5432/inboxshield_test` in workflow; match local dev pattern |
| `npm ci` in CI takes >5 minutes on cold cache | Low — CI is slow but not broken | Medium | Use `actions/setup-node@v4` with npm cache; accept cold-cache slowness |

---

## 13. Rollback Strategy

Every implementation unit is a single commit. Rollback for any unit:

```bash
git revert HEAD    # revert the most recent P0 commit
npm ci             # re-sync dependencies
npx turbo run build  # verify clean state
```

**Cascading rollback considerations:**
- P0-04 (dead-tree cleanup) depends on P0-02 (db repair) and P0-03 (migration). If P0-04 is reverted, P0-02 and P0-03 remain valid — the dead tree reappears but the package and migration are unaffected.
- P0-08 (security) depends on P0-05 (type safety). If P0-08 is reverted, the security protections are removed but type safety remains.
- If P0-05 (type safety) needs to be reverted (too many errors), revert P0-05 only; P0-01 through P0-04 and P0-06 through P0-09 are unaffected.

**Never revert P0-01 (testing foundation) after P0-06 through P0-09 are committed** — those units add tests that depend on the Vitest infrastructure. Revert P0-06–P0-09 first, then P0-01.

---

## 14. Phase 0 Exit Criteria

Phase0 is complete when ALL of the following are true:

- [ ] `packages/engine` has Vitest installed and `npm run test` exits 0 with behavior-based coverage (success, failure, and malformed/error paths for every scanner, orchestrator, heuristic, and builder contract) — counts reported post-implementation, never a gate
- [ ] `@inboxshield/db` is importable (PrismaClient singleton exported from `src/index.ts`)
- [ ] **PostgreSQL migration (primary path):** `packages/db/prisma/migrations/` contains the initial migration and `prisma validate` passes against a real database. **Fallback (no PostgreSQL available):** the migration SQL is generated deterministically via `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, `prisma validate` passes, and P0-03 is explicitly marked **BLOCKED-on-DB** — runtime verification is never claimed when it did not happen
- [ ] `packages/db` dead tree is removed (no `packages/db/apps/`, `packages/db/packages/`, `packages/db/docs/` directories)
- [ ] `HistoryService` exists in `packages/db/src/services/history.service.ts` (uses `PrismaClient`; imports `ReportModel` type-only from `@inboxshield/engine`)
- [ ] `packages/engine` is persistence-agnostic: grep-verified zero `PrismaClient`, zero PostgreSQL imports, zero DB CRUD in `packages/engine/**`
- [ ] `apps/web/next.config.ts` has no `ignoreBuildErrors` setting
- [ ] `next build` in `apps/web/` exits 0
- [ ] `turbo run typecheck` exits 0 across all workspaces
- [ ] `IpBlacklistScanner` is exported from `packages/engine` and has passing tests
- [ ] `docs/SCANNER_UNIFICATION_REPORT.md` exists with the comparison table
- [ ] `apps/worker/src/scanners/types.ts` defines `ScanStatus` and `ScannerResult`; all stub scanners conform
- [ ] `dnssec.scanner.ts` returns `status: 'UNSUPPORTED'` with `passed: null` — never a fabricated boolean
- [ ] `whois.scanner.ts` returns `status: 'UNSUPPORTED'` with no fabricated `ageDays` (never `{ ageDays: 365 }`)
- [ ] `reports.ts` methods throw `NOT_IMPLEMENTED` errors (never return fake buffers/CSV)
- [ ] Dashboard has a visible "Demo data" disclaimer
- [ ] `POST /api/scan` rejects private IPs, invalid domains, and rate-limited requests (via the `RateLimiter` interface)
- [ ] `POST /api/scan` 500 responses never leak `error.message`
- [ ] `ReportModel.metadata.version === '1.0.0'` (frozen evidence contract)
- [ ] Contract tests assert `ScannerResult`, `EngineReport`, and `ReportModel` shapes
- [ ] `.github/workflows/ci.yml` exists with all 8 gates
- [ ] All workspaces build: `turbo run build` exits 0
- [ ] All workspaces lint: `turbo run lint` exits 0
- [ ] `npm audit --audit-level=high` exits 0
- [ ] All P0-XX commits are on the branch (no implementation code from Phase1 mixed in)

---

## 15. Explicitly Deferred Beyond Phase 0

The following are NOT part of Phase 0 and must not be implemented until Phase 1 or later:

- Real authentication (OAuth, session management, middleware.ts)
- Database write/read paths (ScanReport persistence in web or worker)
- Scanner removal (worker scanner files are compared but not deleted in Phase0)
- Worker processor implementation (BullMQ stub stays as-is)
- Dashboard DB wiring (hardcoded data stays, labeled as demo)
- PDF/CSV export (throws "not implemented" in P0-07; actual implementation is Phase3)
- Production rate limiting via `RedisRateLimiter` (P0-08 establishes the `RateLimiter` interface + dev-only `LocalMemoryRateLimiter`; the Redis-backed implementation is the Phase1 production boundary — the interface is already compatible)
- Full `ScanStatus` contract adoption across the remaining worker scanners (P0-07 introduces the status taxonomy on the DNSSEC/WHOIS/SMTP stubs; applying it to the real scanners is part of Phase2 scanner unification)
- SMTP banner/EHLO analysis (worker `checkPort25` stays a TCP-connect-only `PARTIAL` check; full banner analysis is deferred)
- `apps/web` domain detail page wiring
- BullMQ scheduled scan jobs
- OmniRouteAI wiring
- ReportBuilder integration with DB writes
- ASC-Orchestrator integration (separate Python project — Phase2+)
- Billing / multi-tenancy / RBAC / white-label / client portal
- Alerts / Slack / DMARC XML / BIMI / MTA-STS / TLS-RPT
- Load testing (k6 / Artillery)
- E2E testing (Playwright)
- Docker Compose for local dev
- Structured logging (pino / winston)
- Graceful shutdown
- Health checks with dependency probes
- `packages/types` cleanup (dead types, imported nowhere)
- `packages/eslint-config` cleanup (unused by apps/web)
- Documentation accuracy pass (12+ false claims identified in `CURRENT_STATE_AUDIT.md` §6)

---

## PHASE 0 EXECUTION QUEUE

Execute in exact order. Each unit is one commit. Wait for explicit approval before starting each unit.

```
P0-01  Testing foundation
       Install Vitest in packages/engine, create scanner + orchestrator + heuristic + builder tests
       Behavior-based coverage: each of the 7 scanners (valid / missing / malformed paths), safeExecute, scoring, risk thresholds, and ReportModel shape (counts reported post-implementation only)
       Commit: "test: establish Vitest foundation and scanner contract tests for @inboxshield/engine"

P0-02  @inboxshield/db package repair
       Create src/index.ts with PrismaClient singleton, fix main field in package.json
       Commit: "fix: repair @inboxshield/db package entrypoint with PrismaClient singleton"

P0-03  Database migration baseline
       Primary: generate + validate initial Prisma migration against real PostgreSQL.
       Fallback (no PG available): deterministic SQL via prisma migrate diff, mark BLOCKED-on-DB, never claim runtime verification
       Commit: "chore: establish Prisma migration baseline for InboxShield PostgreSQL schema"

P0-04  Dead-tree classification and safe cleanup
       Migrate HistoryService to packages/db/src/services/ (type-only ReportModel import from engine), delete 5 dead-tree files
       packages/engine stays persistence-agnostic — no PrismaClient, no PostgreSQL, no DB CRUD
       Commit: "chore: migrate HistoryService to packages/db persistence layer and remove packages/db dead tree"

P0-05  Type-safety enforcement
       Remove ignoreBuildErrors, fix all surfaced errors, add typecheck to turbo.json
       Commit: "fix: enforce strict type safety by removing ignoreBuildErrors and fixing all surfaced errors"

P0-06  Scanner unification plan and IP-RBL migration
       Create IpBlacklistScanner (BaseScanner), write comparison report, add tests
       Commit: "feat: migrate IP-RBL scanner to engine and establish scanner unification report"

P0-07  Stub / fabricated-output quarantine (truthful status taxonomy)
       Create ScanStatus (PASS/FAIL/ERROR/UNSUPPORTED/DISABLED/PARTIAL) in apps/worker/src/scanners/types.ts
       DNSSEC/WHOIS → UNSUPPORTED (no fabricated pass/fail or ageDays), SMTP → PARTIAL (real connect, no banner claim),
       reports → NOT_IMPLEMENTED throw, dashboard → demo disclaimer
       Commit: "fix: quarantine fabricated stub outputs with truthful ScanStatus taxonomy"

P0-08  /api/scan security hardening
       Domain validation, SSRF defense, 30s timeout, safe errors,
       rate limiting via RateLimiter interface (LocalMemoryRateLimiter dev-only; RedisRateLimiter documented as production boundary)
       Commit: "fix: harden /api/scan with domain validation, SSRF defense, pluggable rate limiting, and safe errors"

P0-09  Deterministic evidence contracts
       Freeze ReportModel version, JSDoc rawData immutability, shape contract tests
       Commit: "feat: freeze deterministic evidence contract with versioned ReportModel and shape tests"

P0-10  CI validation gates
       GitHub Actions workflow: npm ci, audit, prisma validate/generate, build, lint, typecheck, test
       Commit: "ci: add GitHub Actions validation gates for build, lint, typecheck, test, and Prisma"
```

---

*This is the Phase 0 implementation contract. Awaiting explicit approval to begin P0-01.*
