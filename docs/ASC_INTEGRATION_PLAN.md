# InboxShield AI — ASC-Orchestrator Integration Plan (Corrected)

**Date:** 2026-08-08 (revision of the same-date original)
**Type:** Architecture analysis and integration boundary definition
**Baseline:** branch `audit/inboxshield-saas-baseline`, HEAD `17cd585`
**Scope:** Read-only analysis. **No integration is performed.**

> **Correction notice (2026-08-08):** An earlier version of this document described ASC-Orchestrator as "the set of integration seams connecting web and worker." **That was wrong.** ASC-Orchestrator v1.0.0 is a **separate, already-released Python project** and must remain an independent stable dependency. The InboxShield web↔worker integration seams are **InboxShield product architecture** — they are not ASC-Orchestrator. This revision separates the two concerns cleanly: this document is about the **ASC boundary**; the web↔worker seams appear here only as a clearly-labeled **prerequisite** (§7).

---

## 1. ASC-Orchestrator Truth (v1.0.0)

ASC-Orchestrator v1.0.0:

- is a **separate Python project**
- is **already released**
- **must not be copied into InboxShield**
- **must not be vendored into the TypeScript monorepo**
- **must not replace BullMQ**
- **must not replace deterministic scanners**
- **must not own factual deliverability truth**
- **must not directly decide SPF/DKIM/DMARC pass/fail**
- **must not directly perform ordinary low-level background jobs**

### 1.1 What ASC-Orchestrator IS for

ASC is intended for **high-level mission orchestration** — the runbook around a deliverability event, not the low-level checks themselves:

```
Deliverability degradation detected
  → open mission
  → request/associate evidence collection
  → wait for scan completion
  → validate evidence availability
  → create remediation workflow
  → apply risk gates
  → wait for human/system remediation
  → request re-verification
  → compare before/after evidence references
  → close or escalate mission
```

Every arrow above is an **orchestration decision**. The *evidence collection* and *re-verification* steps are executed by InboxShield; ASC only requests, gates, validates availability, and compares **references** to that evidence.

---

## 2. The Boundary

```
┌──────────────────────────────────────────────────────────────┐
│ InboxShield AI  (TypeScript monorepo)                        │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────┐  │
│  │ Next.js UI  │   │ Fastify APIs │   │ BullMQ + Redis   │  │
│  └─────────────┘   └──────────────┘   └──────────────────┘  │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Domain scan execution · deterministic scanners           │ │
│  │ scan evidence · scoring/rules · history · alerts         │ │
│  │ operational retries · scheduled low-level scans          │ │
│  └─────────────────────────────────────────────────────────┘ │
│  │  PostgreSQL (product data = source of truth)              │
│  └───────────────────────────────────────────────────────────┘
              │  (future integration seam — §6)
              ▼
┌──────────────────────────────────────────────────────────────┐
│ ASC-Orchestrator v1.0.0  (separate Python project, released) │
│  mission lifecycle · evidence-gated progression              │
│  multi-step remediation workflows · validation · risk        │
│  recovery · escalation · mission completion                  │
│  Owns ONLY orchestration-domain state + evidence REFERENCES  │
└──────────────────────────────────────────────────────────────┘
```

**One-sentence boundary rule:** InboxShield produces and owns the facts; ASC orchestrates missions around those facts and references them by ID. Neither layer implements the other's responsibilities.

---

## 3. InboxShield Responsibility vs ASC Responsibility

| InboxShield (product) — **remains responsible for** | ASC-Orchestrator — **owns only** |
|---|---|
| Next.js product UI | mission lifecycle (open, progress, close, escalate) |
| Fastify / product APIs | orchestration events |
| PostgreSQL product data | validation / risk state |
| BullMQ | recovery state |
| Redis | references to InboxShield evidence |
| domain scan execution | — |
| deterministic scanners | — |
| scan evidence | — |
| scoring / rules | — |
| history | — |
| alerts | — |
| operational retries | — |
| scheduled low-level scans | — |

**The split is categorical, not proportional.** ASC owns one category of state (orchestration) and *references* to InboxShield evidence. InboxShield owns everything factual and operational.

---

## 4. Data Ownership

### 4.1 InboxShield product data — source of truth (unchanged)

| Data | Writer | Reader | Store |
|---|---|---|---|
| users / organizations / workspaces | Web (on signup) | Web | PostgreSQL |
| domains | Web (user adds) | Web, Worker | PostgreSQL |
| scans | Worker (via BullMQ) | Web | PostgreSQL (ScanReport) |
| scanner evidence | Worker (engine scanners) | Web, ASC (via reference) | `ScanReport.reportModel` Json |
| findings | Engine (HeuristicAiProvider) | Web | inside `reportModel` |
| scores | Engine (`globalScore`) | Web | `ScanReport.score`, `.riskLevel` |
| DNS snapshots | Worker (scan result) | Web | inside `reportModel` |
| reports | Web / Worker | Web | PostgreSQL |
| alerts | Worker | Web | PostgreSQL (or alert sink) |
| remediation evidence | Worker/Web | ASC (via reference) | PostgreSQL |

### 4.2 ASC orchestration state — referenced, not duplicated

| Data | Owner | Note |
|---|---|---|
| mission ID | ASC | ASC's own store |
| mission lifecycle | ASC | open → in-progress → closed/escalated |
| orchestration events | ASC | audit trail of mission decisions |
| validation / risk state | ASC | risk gate outcomes |
| recovery state | ASC | remediation step status |
| evidence references | ASC | **InboxShield scan IDs / evidence IDs — never copied scanner data** |

**Rule:** ASC must reference InboxShield scan IDs / evidence IDs rather than duplicate factual scanner data. When ASC needs facts (e.g., "did SPF change between before/after?"), it asks InboxShield for the evidence reference and InboxShield serves the stored `reportModel` — ASC never parses DNS itself.

---

## 5. BullMQ vs ASC — do not collapse the layers

| Layer | Job type | Examples |
|---|---|---|
| **BullMQ** (InboxShield worker) | Low-level, high-volume, operational | execute scan jobs, retries, scheduling, webhook processing, operational workers, network I/O jobs |
| **ASC-Orchestrator** (Python) | High-level, stateful, mission-scale | mission lifecycle, evidence-gated progression, multi-step remediation workflows, validation, risk handling, recovery, escalation, mission completion |

**Do not collapse these layers.** Specifically:

- BullMQ must continue to own job execution, retries, and scheduling. ASC must not "re-drive" individual scans through its own queue.
- ASC's evidence-gated progression depends on BullMQ completing scans — ASC waits for completion events; it does not execute scans.
- Moving ASC's mission logic into BullMQ would turn a stable released dependency into app code (forbidden). Moving BullMQ jobs into ASC would outsource factual deliverability truth to a non-factual orchestrator (also forbidden).

---

## 6. Python / TypeScript Integration Boundary

The future seam between the **InboxShield TypeScript monorepo** and the **ASC-Orchestrator v1.0.0 Python runtime**. Three candidate models; each is evaluated on nine criteria. Nothing here is implemented.

### 6.1 Option A — Direct subprocess / CLI invocation

InboxShield's worker spawns `asc-orchestrator <mission> …` (or `python -m asc_orchestrator …`) as a child process and parses its exit code/stdout.

| Criterion | Assessment |
|---|---|
| Development simplicity | **High** — no extra service to run; invoke like a CLI tool; easy to debug locally |
| Production suitability | **Low–Medium** — exit codes + stdout are a thin protocol; no streaming events; poor for long-running missions with mid-flight gates |
| Failure isolation | **Medium** — a crash kills only that job, but orphan/zombie process management and kill-timeouts are on InboxShield |
| Security | **Medium** — command-injection surface on args; secrets must go via env, not argv; need `--` arg discipline |
| Deployment complexity | **Low** — one runtime; but requires Python + ASC installed on the same host/image as the worker |
| Observability | **Low** — unstructured stdout/exit-code only; no native health/metrics/tracing contract |
| State ownership | **Ambiguous** — ASC keeps mission state in its own store; InboxShield must poll/query back for status; no push channel |
| Windows / local dev | **Medium** — subprocess works on Windows but Python path/venv differences and console-window handling add friction |
| Future SaaS deployment | **Low–Medium** — two runtimes in one container is messy; separating them later is a rewrite of the seam |

### 6.2 Option B — Local Python HTTP service

ASC runs as its own HTTP service (its released interface, or a thin FastAPI wrapper) reachable from the InboxShield worker (localhost in dev, sidecar in production).

| Criterion | Assessment |
|---|---|
| Development simplicity | **Medium** — one more service to boot locally (docker-compose or a script); but a clean REST contract |
| Production suitability | **High** — HTTP is a stable, versionable contract; supports request/response + async callbacks/SSE/webhooks; scales by replica count |
| Failure isolation | **High** — separate process; an ASC crash does not take down InboxShield; retry on HTTP is straightforward |
| Security | **Medium–High** — must bind internally and authenticate the seam (token or mTLS); never exposed publicly |
| Deployment complexity | **Medium** — two deployables (web/worker image + ASC image) behind one orchestration unit; standard pattern |
| Observability | **High** — HTTP logs, health endpoint, request tracing, metrics — all standard tooling |
| State ownership | **Clear** — ASC owns mission state; InboxShield queries/commands via API; single well-defined contract |
| Windows / local dev | **High** — a Python HTTP service runs natively on Windows; trivial to run alongside the monorepo |
| Future SaaS deployment | **High** — sidecar pattern maps directly to containers; each layer scales independently; cloud-native |

### 6.3 Option C — Event / queue adapter model

Both sides attach to a shared broker (existing Redis/BullMQ, or a neutral bus such as RabbitMQ/Redis Streams/Kafka/NATS). InboxShield emits scan/evidence events; ASC consumes mission-intent events and emits control events back.

| Criterion | Assessment |
|---|---|
| Development simplicity | **Low** — BullMQ's job format is JS-specific; a Python consumer would need to reverse-engineer/adapt the protocol, or both sides adopt a new neutral broker — real adapter work |
| Production suitability | **High** — durable, async, decoupled; ideal for high-volume event flows |
| Failure isolation | **High** — broker decouples lifecycles; backpressure and retry are native |
| Security | **Medium** — broker auth + payload validation; event schemas become a cross-runtime contract |
| Deployment complexity | **Medium–High** — shared broker + adapters on both sides; versioning of event schemas |
| Observability | **Medium–High** — queue metrics are good, but cross-runtime correlation/tracing is harder |
| State ownership | **Distributed** — both sides hold events; source-of-truth split must be designed explicitly; idempotency is critical |
| Windows / local dev | **Low–Medium** — needs a broker running locally; Redis already exists in the project, but the BullMQ-protocol mismatch is the real cost |
| Future SaaS deployment | **High** — the most scalable long-term, but only after the protocol problem is solved |

### 6.4 Recommendation

| Priority | Architecture | Rationale |
|---|---|---|
| **Primary** | **Option B — local Python HTTP service** | Cleanest stable boundary with the released ASC project; high observability; native Windows dev; sidecar-ready for SaaS; the "does not collapse layers" requirement is structurally enforced by a process + HTTP seam |
| **Development fallback** | **Option A — direct subprocess/CLI invocation** | Fastest to prototype locally without booting an extra service; switch to B for production. Acceptable because mission runs are infrequent enough that subprocess overhead is fine in dev |
| Not recommended now | Option C — event/queue adapter | BullMQ's JS-specific protocol makes a Python adapter a real project, and it pulls the two runtimes toward each other's internals. Revisit only with a neutral broker and only if mission event volume demands it |

**Decision rule for later:** whichever option is chosen, ASC remains a separate Python deployment, referenced via its released interface. InboxShield never imports, vendors, or reimplements ASC, and ASC never parses DNS or computes scanner facts.

---

## 7. Prerequisite (NOT ASC): InboxShield Product Integration

> **This section is InboxShield product architecture. It is the web↔worker integration that was previously mislabeled as "ASC."** It must exist before ASC orchestration is meaningful, because ASC gates on InboxShield evidence — and evidence cannot be gated on until InboxShield persists and serves it.

Today the web and worker share no code path and no data path (`CURRENT_STATE_AUDIT.md` §5). The prerequisite work:

### 7.1 Scan lifecycle boundary (product)

```
apps/web                          BullMQ (Redis)                      apps/worker
┌──────────────────┐              ┌──────────────┐                   ┌──────────────────┐
│ POST /api/scan   │──enqueue──→  │ scan jobs    │  ──process──→     │ WorkerProcessor    │
│  (authenticated) │              │ (webhook-    │                   │  calls engine     │
│                  │              │  ingestion)  │                   │  writes ScanReport│
│ GET /api/scans   │←──read──────── PostgreSQL ────────────────── writes
└──────────────────┘              └──────────────┘                   └──────────────────┘
```

- Web **enqueues** scan requests; worker **executes** via `@inboxshield/engine`; worker **writes** `ScanReport`; web **reads** for display/export.
- Data ownership within the product is fixed by §4.1 above (worker writes scans, web reads them, `reportModel` is the handoff payload).
- The scan lifecycle (QUEUED → RUNNING → COMPLETED / FAILED / RETRYING) is an **InboxShield product concept** tracked by BullMQ job state — not an ASC mission.

### 7.2 Scanner unification (product)

The single most important product-internal task (from `CURRENT_STATE_AUDIT.md` §7 blocker #1): the worker's 10 independent scanners and its `ScoringEngine` must be replaced by canonical `@inboxshield/engine` calls. The worker's IP-RBL blacklist logic migrates into the engine as a new `BaseScanner` (`network:blacklist:ip`). Worker stubs (DNSSEC, WHOIS, SMTP connect-only) are dropped, not ported. Scoring unifies on the engine's `100 − Σ(weights)` formula.

### 7.3 Product integration phases (reference for `SAAS_GAP_ANALYSIS.md` §4 and `TESTING_GAP_ANALYSIS.md` §7)

| Phase | Work |
|---|---|
| P-0 | Fix `@inboxshield/db` (index.ts + PrismaClient export), run initial migration, add engine unit tests, clean dead tree (see §8 of `CURRENT_STATE_AUDIT.md`) |
| P-1 | Real auth, middleware, rate limiting; `/api/scan` writes to DB |
| P-2 | Scanner unification (§7.2), real webhook processor, scheduled scans |
| P-3 | Dashboard + domain detail read from DB; PDF/CSV export |
| P-4 | Production hardening (logging, health probes, CI/CD, E2E) |

---

## 8. Future ASC Integration Phases (not to be implemented yet)

Only after product integration (§7) makes scan evidence persistent and queryable:

| Phase | Work | Depends on |
|---|---|---|
| A-1 | Choose seam per §6.4 (HTTP primary); stand up ASC locally as a dev dependency | §7 P-1 (evidence persists) |
| A-2 | InboxShield exposes evidence-reference API (e.g., `GET /api/evidence/:scanId`) that ASC can call | §7 P-2 (scan history) |
| A-3 | Wire degradation-detection → mission-open: product alert emits an event; ASC receives it via the seam | A-2 |
| A-4 | Evidence-gated progression: ASC requests re-verification; InboxShield enqueues a new scan; ASC compares before/after references | §7 P-2 (re-scan capability) |
| A-5 | Risk gates, remediation workflow, escalation, mission close | A-4 |

---

## 9. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Confusing product integration with ASC integration (the error this revision fixes) | High — wrong plans, wrong code ownership | This document's hard split (§2–§5); review gate before any ASC work starts |
| Vendoring or copying ASC into the monorepo | High — breaks independent-dependency rule | CI/repo hygiene; ASC stays out of the repo entirely |
| Collapsing BullMQ and ASC layers | High — outsources execution or imports mission logic into app code | §5 layering rule; both layers stay structurally distinct |
| ASC duplicating factual data | Medium — two sources of truth for the same fact | §4.2 rule: references only, evidence served by InboxShield |
| Seam choice makes Windows/local dev painful | Medium — stalls development | §6.4 primary (HTTP) + fallback (CLI) both work natively on Windows |
| Python HTTP seam unauthenticated in prod | Medium — internal API abused | Bind internally; token/mTLS auth on the seam |

---

## 10. Out of Scope / Do-Nots

- **Do not implement ASC integration now** — analysis only.
- Do not copy, vendor, or fork ASC-Orchestrator into InboxShield.
- Do not replace BullMQ with ASC, and do not move BullMQ jobs into ASC.
- Do not let ASC decide SPF/DKIM/DMARC pass/fail or own deliverability truth.
- Do not add new SaaS features in service of ASC.
- Do not treat the web↔worker seams (§7) as ASC work.

---

## 11. Success Criteria (when ASC integration is eventually done)

1. ASC runs as a separate Python process (per §6.4) and is not part of the monorepo build.
2. ASC references InboxShield scan/evidence IDs and never stores copied scanner data.
3. BullMQ still executes every scan job; ASC never executes a scan.
4. A mission lifecycle (open → evidence-gated progress → re-verify → close/escalate) works end-to-end against real InboxShield evidence.
5. No scanner, scoring, or persistence code lives in ASC, and no mission code lives in InboxShield.

---

*This is audit document 3 of 4 (corrected). Companion documents: `CURRENT_STATE_AUDIT.md`, `SAAS_GAP_ANALYSIS.md`, `TESTING_GAP_ANALYSIS.md`.*
