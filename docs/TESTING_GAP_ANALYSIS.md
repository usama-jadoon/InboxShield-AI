# InboxShield AI — Testing Gap Analysis

**Date:** 2026-08-08
**Type:** Testing infrastructure and coverage audit
**Baseline:** branch `audit/inboxshield-saas-baseline`, HEAD `17cd585`
**Scope:** Read-only. No test frameworks added. No tests written.

> This document answers: "What is the actual testing state of this repository, what is missing, and what must exist before any SaaS build-out is safe to attempt?" Every claim is verified against the filesystem; documentation claims of test infrastructure were treated as unverified and cross-checked.

---

## 1. Current Test Reality (what actually exists)

### 1.1 Test frameworks installed

| Framework | Installed? | Evidence |
|---|---|---|
| Vitest | **NO** | Not in any `package.json`. Not in `node_modules` root. |
| Jest | **NO** | Not in any `package.json`. |
| Mocha | **NO** | Not in any `package.json`. |
| Playwright | **NO** | Not in any `package.json`. |
| k6 | **NO** | Not a Node dependency; not configured anywhere. |
| Testing Library | **NO** | Not in any `package.json`. |
| Supertest | **NO** | Not in any `package.json`. |
| Prisma test utilities | **NO** | Not configured. |
| Any test runner | **NO** | Nothing. |

### 1.2 Test scripts

| Workspace | Has `test` script? | Evidence |
|---|---|---|
| Root `package.json` | `"test": "turbo run test"` — exists but runs nothing | No workspace defines a `test` script; `turbo run test` resolves to "no tasks" |
| `apps/web` | **NO** `test` script | `package.json` scripts: dev, build, start, lint only |
| `apps/worker` | **NO** `test` script | `package.json` scripts: dev, build, start only |
| `packages/engine` | **NO** `test` script | `package.json` has only `build`, `typecheck`, `prepublishOnly` |
| `packages/db` | **NO** `test` script | `package.json` scripts: generate, build only |
| `packages/types` | **NO** `test` script | `package.json` scripts: build, typecheck only |

### 1.3 Test files on disk

| Path | What it is | Is it a test? |
|---|---|---|
| `packages/engine/tests/orch.ts` | Manual demo script with `console.log` output against gmail.com, google.com, outlook.com, icloud.com, proton.me | **NO** — no assertions, no test framework, no test runner invocation. This is a manual inspection script, not automated test coverage. |
| Any other `*.test.ts` or `*.spec.ts` | — | **NONE EXIST** |

### 1.4 CI/CD test gates

| System | Exists? | Evidence |
|---|---|---|
| GitHub Actions | **NO** | No `.github/workflows/` directory |
| GitLab CI | **NO** | No `.gitlab-ci.yml` |
| CircleCI | **NO** | No `.circleci/` |
| Any CI pipeline | **NO** | Nothing |

**Summary:** The repository has **zero automated test coverage, zero test infrastructure, and zero CI gates.** The root `turbo run test` script is a no-op.

---

## 2. Documentation Claims vs. Reality

The following documents claim test infrastructure that does not exist:

| Document | Claim | Reality |
|---|---|---|
| `README.md` | "Testing: Vitest for unit, Testcontainers for integration, Playwright for E2E, k6 for load testing" | **NONE of these exist.** No framework installed, no tests written. |
| `docs/formal/11-Testing.md` | Detailed testing strategy (9 test levels, Vitest config, Testcontainers, Playwright, k6 benchmarks, test gates) | **Entirely aspirational.** Describes a plan, not an implementation. Zero test files. |
| `ReleaseReadinessReport.md` (score 10/10) | "Testing: Unit + integration" | **False.** No tests of any kind. |

**Note:** `docs/formal/11-Testing.md` is not dishonest in the way some other docs are — it reads as a *plan document*, not a status claim. However, the README and ReleaseReadinessReport present the testing state as implemented, which it is not.

---

## 3. What Should Be Tested (gap by subsystem)

### 3.1 packages/engine — the scanner library (HIGHEST PRIORITY)

This is the only subsystem with real logic that is reused across the application. Every scanner has non-trivial DNS parsing, edge cases, and error paths.

| Component | Test category | Specific test cases needed | Current coverage |
|---|---|---|---|
| `DnsScanner` | Unit | Valid A record, NXDOMAIN, SERVFAIL, timeout, empty answer, malformed JSON from DoH | **0%** |
| `SpfScanner` | Unit | Valid SPF, missing SPF, multiple SPF records (RFC 7208), `~all` vs `-all` vs `?all`, `+all`, TXT lookup failure, malformed record | **0%** |
| `DkimScanner` | Unit | Known selector found, selector not found (7 attempts), key size estimation by length, invalid DKIM record, timeout, empty selector list | **0%** |
| `DmarcScanner` | Unit | Valid DMARC `p=reject`, `p=quarantine`, `p=none`, missing DMARC, malformed record, `_dmarc` subdomain lookup | **0%** |
| `MxScanner` | Unit | Multiple MX records, null MX (`.`), single MX, no MX, TXT lookup failure | **0%** |
| `TlsScanner` | Unit | Valid STARTTLS, expired cert, weak protocol, self-signed, port 25 unreachable, timeout, EHLO failure, STARTTLS not supported | **0%** (also: requires network egress — needs mock or integration test) |
| `BlacklistScanner` | Unit | Clean domain (not listed), listed on spamhaus, listed on surbl, DNS failure, timeout | **0%** |
| `EngineOrchestrator` | Unit | Single scanner, multiple scanners, scanner throws (safeExecute), score calculation, risk thresholds, empty scanner set | **0%** |
| `HeuristicAiProvider` | Unit | All 7 flag combinations, no flags set (healthy), all flags set (unhealthy), partial flags | **0%** |
| `ReportBuilder` | Unit | Valid report + recommendations, report with errors, empty recommendations, edge cases in section rendering | **0%** |
| `DoHClient` | Unit/Integration | Valid response, timeout, malformed response, network error | **0%** (mock or integration) |

**Engine test count estimate:** ~60–80 unit tests across all components.

### 3.2 apps/web — Next.js application

| Component | Test category | Specific test cases needed | Current coverage |
|---|---|---|---|
| `/api/scan` route | Integration | Valid domain, empty domain, malformed domain, rate limiting (future), auth (future), engine failure | **0%** |
| Dashboard page | Component | Renders without crash, handles empty DB state (future) | **0%** |
| Domain detail page | Component | Renders for valid domain, handles missing domain, 404 for unknown domain | **0%** |
| NextAuth route | Integration | Valid login, invalid credentials, session expiry | **0%** |
| Sidebar | Component | Renders all links, active link highlighting | **0%** |

**Web test count estimate:** ~20–30 unit + integration tests.

### 3.3 apps/worker — Fastify + BullMQ

| Component | Test category | Specific test cases needed | Current coverage |
|---|---|---|---|
| Fastify server | Integration | Health check, 404 for unknown routes, POST /v1/webhooks | **0%** |
| BullMQ queue | Integration | Enqueue, dequeue, retry on failure, max attempts reached (requires Redis) | **0%** |
| Webhook worker | Integration | Process event, handle malformed event, DB write, engine failure (requires Redis + mock engine) | **0%** |
| Scanner utilities | Unit | Same as engine tests above for the worker-specific scanners (IP RBL) | **0%** |

**Worker test count estimate:** ~25–35 unit + integration tests.

### 3.4 packages/db

| Component | Test category | Specific test cases needed | Current coverage |
|---|---|---|---|
| Prisma schema | Validation | `prisma validate` passes (manual check: ✅) | **N/A** (not a runtime test) |
| Prisma migrations | Integration | Migration applies cleanly, rollback works, indexes are created | **0%** |
| HistoryService (dead) | Unit | saveSnapshot, getHistory, getSnapshot (requires Prisma test DB) | **0%** (dead code, but worth testing once resurrected) |

### 3.5 Cross-cutting

| Category | What's needed | Current |
|---|---|---|
| Type checking | `tsc --noEmit` across all workspaces | `packages/engine` has `typecheck` script; others don't. Apps suppress errors (`ignoreBuildErrors`). |
| Lint | Consistent ESLint across workspaces | `apps/web` has its own config; `apps/worker` and packages have no lint script |
| Security | Dependency audit (`npm audit`) | Not run in CI; was run manually in prior session |
| Build | All packages build cleanly | `turbo run build` exists; passes for engine + web (with `ignoreBuildErrors`); worker build status not tested |

---

## 4. Recommended Test Pyramid

```
                    ┌─────────────┐
                    │   E2E (5%)  │   Playwright (web UI flows)
                    │  ~5-10 tests│   Login → Dashboard → Domain → Scan
                    └──────┬──────┘
                   ┌───────┴────────┐
                   │ Integration(25%)│   API + Worker + DB (Testcontainers)
                   │  ~25-40 tests   │   POST /api/scan → DB write → GET result
                   │                 │   BullMQ enqueue → worker process → DB
                   └───────┬────────┘
              ┌────────────┴────────────┐
              │    Unit Tests (70%)      │   Each scanner, orchestrator, builder,
              │     ~80-120 tests        │   heuristic, scoring, DoH client
              │                          │   Fast, no network, mock DNS
              └──────────────────────────┘
```

### 4.1 Unit tests (foundation — build first)

- **Framework:** Vitest (modern, fast, TypeScript-native, already referenced in docs/formal/11)
- **Location:** Co-located with source (e.g., `packages/engine/src/scanners/dns.scanner.test.ts`) or in `packages/engine/tests/`
- **Mocking:** `vi.mock()` for `DoHClient` to avoid real DNS in unit tests; real DoH in integration tests
- **Run:** `vitest run` per workspace; `turbo run test` at root
- **Priority:** `packages/engine` scanners → `EngineOrchestrator` → `HeuristicAiProvider` → `ReportBuilder` → worker utilities

### 4.2 Integration tests (wire things together)

- **Framework:** Vitest + Testcontainers (for PostgreSQL and Redis)
- **What they verify:** DB migrations apply, scan result persists and is queryable, BullMQ job is processed by worker, auth session works
- **Run:** Require Docker; separate `test:integration` script
- **Priority:** DB write/read cycle → BullMQ enqueue/process → `/api/scan` end-to-end with real DB

### 4.3 E2E tests (full user journey)

- **Framework:** Playwright
- **What they verify:** User can log in, see dashboard, add domain, trigger scan, view results, export PDF
- **Run:** Requires running app + DB + Redis; `test:e2e` script
- **Priority:** Lowest — only after unit + integration are solid

### 4.4 Load tests (capacity validation)

- **Tool:** k6 (as docs/formal/11 suggests) or Artillery
- **What they verify:** Scan endpoint throughput, worker concurrency, DB write performance under load
- **Run:** Manual or CI-gated, post-deployment
- **Priority:** Lowest — only before production deployment

---

## 5. Required Test Infrastructure (must exist before any testing begins)

### 5.1 Per-workspace setup

| Workspace | `package.json` script needed | `vitest.config.ts` needed | Notes |
|---|---|---|---|
| `packages/engine` | `"test": "vitest run"`, `"test:watch": "vitest"` | Yes | Highest priority. Can run standalone. |
| `apps/worker` | `"test": "vitest run"` | Yes | Needs mock Redis for unit tests; Docker Redis for integration |
| `apps/web` | `"test": "vitest run"` | Yes | Can use `next/jest` or standalone Vitest config |
| `packages/db` | `"test:integration": "vitest run --config vitest.integration.ts"` | Yes (integration config) | Needs Testcontainers PostgreSQL |

### 5.2 Root setup

| Item | What | Notes |
|---|---|---|
| `turbo.json` task | Add `"test": { "dependsOn": ["^build"] }` | Root `npm run test` currently resolves to nothing |
| Root `devDependencies` | `vitest` (latest) | Add to root for shared version |
| `vitest` workspace config | Optional: `vitest.workspace.ts` at root for multi-workspace runs | Convenient but not required |

### 5.3 CI gates (GitHub Actions)

| Gate | Trigger | What it runs | Block merge? |
|---|---|---|---|
| Type check | PR | `turbo run typecheck` across all workspaces | Yes |
| Lint | PR | `turbo run lint` across all workspaces | Yes |
| Unit tests | PR | `turbo run test` (vitest across all workspaces) | Yes |
| Build | PR | `turbo run build` | Yes |
| Integration tests | PR (or scheduled) | `turbo run test:integration` (requires Docker services) | Yes |
| `npm audit` | PR | `npm audit --audit-level=high` | Warn, not block |

### 5.4 Local development support

| Item | Purpose | Notes |
|---|---|---|
| `docker-compose.yml` | Local PostgreSQL + Redis | For integration tests and local dev |
| `.env.test` | Test environment variables | `DATABASE_URL`, `REDIS_URL` for test instances |
| Seed script | Populate test DB with fixture data | `packages/db/prisma/seed.ts` |

---

## 6. Testability Assessment of Current Code

Some aspects of the current code make testing harder or easier:

### Easy to test (good architecture)
- **`packages/engine` scanners** — pure functions taking a domain string, returning a result object. Easy to mock DNS and test logic.
- **`HeuristicAiProvider`** — takes an `EngineReport`, returns recommendations. Pure logic, no side effects.
- **`ReportBuilder`** — takes data, returns structured output. Pure transformation.
- **`EngineOrchestrator`** — Map-based scanner registry, Promise.all execution. Clean seam for mocking.

### Hard to test (needs refactoring before testing)
- **`apps/web/api/scan/route.ts`** — creates `EngineOrchestrator` as a module-level singleton with `new` inside the handler. Difficult to inject mocks.
- **`apps/worker/src/queue/webhook.worker.ts`** — stub. Nothing to test until real implementation exists.
- **TlsScanner** — raw TCP socket + TLS handshake. Requires either a mock server or a test TLS endpoint.
- **Hardcoded dashboard data** — not testable as "correct" since there is no source of truth to validate against.

### Not testable (dead/stub)
- DNSSEC scanner (always returns `true` — what would you assert?)
- WHOIS scanner (always returns `{ passed: true, ageDays: 365 }`)
- ReportGenerator stub (returns fake CSV/PDF)
- Everything in `packages/db/` dead nested tree

---

## 7. Minimum Viable Test Suite (what blocks safe SaaS development)

The following tests must exist before any InboxShield product integration work (the web↔worker seams in `ASC_INTEGRATION_PLAN.md` §7, phases P-1 and beyond) begins, because they provide the safety net for changing code:

| # | Test set | Count est. | Blocks |
|---|---|---|---|
| 1 | Engine scanner unit tests (all 7 scanners + orchestrator) | ~50 | Any scanner change, scoring change, weight adjustment |
| 2 | HeuristicAiProvider unit tests | ~10 | Any recommendation logic change |
| 3 | ReportBuilder unit tests | ~8 | Any report format change |
| 4 | `/api/scan` integration test (mocked engine, real HTTP) | ~5 | Any API contract change |
| 5 | DB migration test (Prisma migrate + seed + query) | ~5 | Any schema change |
| **Total** | | **~78** | **Minimum safe baseline for SaaS work** |

Without these ~78 tests, every code change during the SaaS build-out is a blind edit — the only way to verify correctness is manual testing against live DNS, which is slow, flaky, and does not catch regressions.

---

## 8. Current State vs. Documentation (repeated for emphasis)

| Source | Claims | Actual |
|---|---|---|
| README.md | "Vitest for unit testing, Testcontainers for integration, Playwright for E2E, k6 for load testing" | **Zero of these exist.** No framework installed, no test file on disk, no test script in any workspace. |
| docs/formal/11-Testing.md | "9 test levels", "Vitest configuration", "Testcontainers for PostgreSQL and Redis", "Playwright E2E", "k6 benchmarks", "PR merge gates" | **Entirely a plan document.** Not a single implementation of any of these. |
| ReleaseReadinessReport.md | "Testing: Unit + integration" as part of a "10/10" readiness score | **False.** No tests exist. |
| `turbo.json` | No `test` task defined | `npm run test` at root calls `turbo run test` which finds no tasks — silent no-op |
| `packages/engine/tests/orch.ts` | File exists in tests directory | **Not a test.** Manual demo script with console.log; no assertions, no framework. |

---

## 9. Summary: Testing Reality

```
Current test coverage:              0% (zero test files, zero assertions)
Current test infrastructure:        None (no framework, no config, no CI)
Current CI gates:                    None
Current documentation accuracy:     Claims "comprehensive testing" — reality is zero tests
Minimum tests needed for safe SaaS: ~78 (unit + integration for engine + DB + API)
Estimated time to establish:         1–2 days for infrastructure + engine unit tests
                                     2–3 days for integration tests with Testcontainers
                                     1 week for full test pyramid including E2E
```

**This is the second-most critical blocker** (after the scanner fork). Without test infrastructure, every subsequent InboxShield product integration task (`ASC_INTEGRATION_PLAN.md` §7, phases P-1 to P-4) carries unbounded regression risk.

---

*This is audit document 4 of 4. Companion documents: `CURRENT_STATE_AUDIT.md`, `SAAS_GAP_ANALYSIS.md`, `ASC_INTEGRATION_PLAN.md`.*
