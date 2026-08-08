# InboxShield AI — Product Requirements Document

**Version:** 1.0 (Canonical)
**Date:** 2026-08-08
**Status:** Baseline — all future product work references this document
**Authority:** Second only to executable repository source code; supersedes `docs/formal/03-Product-Requirements-Document.md`

---

## 1. Problem Statement

Email deliverability failures silently destroy business communication. Most organizations discover authentication misconfigurations (missing SPF, weak DKIM keys, absent DMARC policies) only after deliverability collapses — at which point remediation is urgent, manual, and error-prone. The existing landscape of email security tools is fragmented: MXToolbox provides individual lookups without unified remediation, DMARC aggregator tools focus on aggregate reports without infrastructure scanning, and agency-grade multi-domain management requires stitching together multiple products.

**InboxShield AI** addresses this by providing deterministic, evidence-based email infrastructure scanning with actionable remediation recommendations, unified domain monitoring, and a path toward agency-grade client management.

---

## 2. Product Positioning

InboxShield AI is an **email infrastructure and deliverability operations platform** — a SaaS product where users:

- Connect and monitor multiple domains
- Run deterministic authentication and infrastructure scans (SPF, DKIM, DMARC, MX, TLS, DNS, DNSSEC, BIMI, MTA-STS, TLS-RPT)
- Receive evidence-based remediation recommendations
- Track domain health over time with historical scanning
- Manage multiple client domains (agency model)

**Positioning:** Deterministic scanning + AI-assisted remediation guidance + agency-grade multi-domain management.

---

## 3. Target Users

| User type | Primary need |
|---|---|
| **Email/DevOps engineers** | Diagnose and fix deliverability issues with deterministic evidence |
| **Security/compliance teams** | Audit email authentication posture across all domains |
| **Marketing teams** | Ensure campaign emails reach inboxes |
| **Email agencies/consultants** | Manage deliverability across multiple client domains |
| **SaaS product teams** | Ensure transactional emails are authenticated and delivered |

---

## 4. Primary User Journeys

### Journey 1: Domain scan and remediation
```
User adds domain → Triggers scan → Views score + findings → Reads AI recommendations → Fixes DNS → Re-scans → Before/after comparison
```

### Journey 2: Multi-domain monitoring
```
User adds multiple domains → Dashboard shows health across all → Identifies worst-performing domains → Prioritizes fixes → Tracks improvement over time
```

### Journey 3: Agency client management
```
Agency creates workspace → Adds client domains → Schedules periodic scans → Generates client-facing reports → Manages remediation workflows per client
```

### Journey 4: ESP webhook ingestion
```
ESP (SendGrid/SES/etc.) sends bounce/complaint/delivery events → Worker normalizes → DB records events → Dashboard shows delivery health alongside authentication health
```

---

## 5. Feature Inventory by Implementation Status

### CURRENTLY IMPLEMENTED (verified against repository source)

| Feature | Implementation state | Notes |
|---|---|---|
| **Engine: 7 deterministic scanners** | Working (`@inboxshield/engine`) | DNS, SPF, DKIM, DMARC, MX use DoH via Cloudflare; TLS uses node:dns + TCP :25 SMTP STARTTLS; Blacklist uses node:dns directly |
| **Engine: Orchestrator** | Working | `EngineOrchestrator.analyzeDomain()` — concurrent scanner execution, safeExecute, deterministic scoring |
| **Engine: HeuristicAiProvider** | Working | Flag-based deterministic recommendations — no LLM calls |
| **Engine: ReportBuilder** | Working | `ReportModel` with versioned metadata (`v1.0.0`) |
| **Engine: DoHClient** | Working | Cloudflare DNS-over-HTTPS, bypasses local DNS restrictions |
| **Web: `/api/scan` POST** | Partial | Runs engine orchestrator inline, no auth, no rate limiting, leaks error.message on 500 |
| **Web: NextAuth route** | Stub | Hardcoded `admin@inboxshield.ai` / `test` — not production-safe |
| **Web: Dashboard** | Stub | Hardcoded `84/100`, static domain list, no DB connection |
| **Web: Domain detail** | Stub | Hardcoded `isHealthy = domain === 'google.com'`, no DB |
| **Web: Sidebar** | Stub | Links to `/domains`, `/routing`, `/logs`, `/settings` — all 404 |
| **Web: UI components** | Working | shadcn/ui (button, card, progress) + MetricCard, Sidebar |
| **Worker: Fastify gateway** | Working | Port 3001, `/health`, `/v1/webhooks/:esp` |
| **Worker: BullMQ queue** | Working | `webhook-ingestion` queue config, 3 attempts, exponential backoff |
| **Worker: 10 scanners** | Mixed | 7 real (DNS, SPF, DKIM, DMARC, MX, TLS, IP-Blacklist) + 2 stubs (DNSSEC `passed:true`, WHOIS `ageDays:365`) + 1 partial (SMTP TCP-connect only) |
| **Worker: ScoringEngine** | Working but redundant | Duplicate scoring logic (different weights from engine) |
| **Worker: OmniRouteAI** | Stub | Keyword heuristics only, no LLM integration |
| **Worker: ReportGenerator** | Stub | Fake CSV string + `Buffer.from("%PDF-1.4...")` |
| **DB: Prisma schema** | Working | Workspace → Domain → ScanReport (verified `prisma validate`) |
| **DB: Package export** | Broken | `main: "index.ts"` points to nonexistent file |

### PHASE 0 (foundation fixes — no user-visible changes)

| Feature | Status | Authority |
|---|---|---|
| Testing infrastructure (Vitest in engine) | NOT_STARTED | P0-01 |
| `@inboxshield/db` package repair | NOT_STARTED | P0-02 |
| Prisma migration baseline | NOT_STARTED | P0-03 |
| HistoryService migration to `packages/db` | NOT_STARTED | P0-04 |
| Type-safety enforcement (remove `ignoreBuildErrors`) | NOT_STARTED | P0-05 |
| Scanner unification plan + IP-RBL migration | NOT_STARTED | P0-06 |
| Stub quarantine with truthful status taxonomy | NOT_STARTED | P0-07 |
| `/api/scan` security hardening | NOT_STARTED | P0-08 |
| Deterministic evidence contracts (versioned ReportModel) | NOT_STARTED | P0-09 |
| CI validation gates (GitHub Actions) | NOT_STARTED | P0-10 |

### V1 TARGET (minimum viable SaaS)

| Feature | Required capability |
|---|---|
| **Real authentication** | OAuth (Google/GitHub) via NextAuth, session management, middleware.ts route protection |
| **Domain CRUD** | POST/GET/DELETE `/api/domains` — workspace-scoped domain management |
| **Scan persistence** | `/api/scan` writes `ScanReport` to PostgreSQL via `packages/db` |
| **Scan history** | Domain detail reads scan history from DB, renders real `ReportModel` |
| **Dashboard from DB** | Dashboard reads live data: real scores, real incident counts, real domain list |
| **Rate limiting** | `RateLimiter` interface, `RedisRateLimiter` in production (per-workspace limits) |
| **Scanner unification** | Worker scanners replaced by canonical `@inboxshield/engine` calls |
| **IP-RBL in engine** | `IpBlacklistScanner` as a new `BaseScanner` in engine (migrated from worker) |
| **Worker: real webhook processing** | Normalize ESP events, write `EmailEvent` to DB |
| **Scheduled scans** | BullMQ repeatable jobs for periodic re-scanning |
| **Real PDF export** | `@react-pdf/renderer` component rendering real `ReportModel` |
| **Real CSV export** | Query DB, generate CSV, stream to client |
| **Structured logging** | pino or winston, correlation IDs, structured JSON |
| **Health checks** | `/health` verifies DB, Redis, downstream dependencies |
| **CI/CD** | GitHub Actions: typecheck, lint, build, test, prisma validate, npm audit |

### LATER (post-V1, explicitly deferred)

| Feature | Scope |
|---|---|
| **DNSSEC validation** | Real DNSKEY/AD-flag resolution (currently stub) |
| **WHOIS lookup** | External API integration for domain age/registration (currently stub) |
| **SMTP banner analysis** | Full EHLO/STARTTLS analysis beyond TCP reachability (currently PARTIAL) |
| **BIMI record verification** | TXT record lookup + logo verification |
| **MTA-STS policy checking** | DNS + HTTPS policy resolution |
| **TLS-RPT policy checking** | DMARC-style TLS reporting policy |
| **Header diagnostics** | Email header analysis for routing/tracing |
| **Bounce/rejection diagnostics** | Pattern analysis from ESP webhook data |
| **DNS change detection** | Before/after snapshot comparison, change alerts |
| **Google Workspace compliance** | Workspace-specific email authentication checks |
| **Microsoft 365 compliance** | M365-specific email authentication checks |
| **DMARC aggregate report ingestion** | Parse XML aggregate/forensic reports |
| **Unauthorized sender detection** | Cross-reference SPF/DKIM/DMARC with observed senders |
| **Domain/IP reputation history** | Time-series reputation tracking across scans |
| **Before/after verification** | Re-scan after DNS change, diff report |
| **OmniRouteAI real LLM** | Replace heuristic stub with actual LLM provider |
| **Client portal** | White-labeled client-facing domain status dashboard |
| **Agency/workspace management** | Multi-client workspace hierarchy |
| **Multi-tenancy RBAC** | Role-based access control across workspaces |
| **Billing integration** | Usage-based or subscription billing |
| **Alerts** | Email/webhook notifications on status changes |
| **SLA monitoring** | Scan frequency SLAs, uptime tracking |

---

## 6. Functional Requirements

### FR-1: Domain Authentication Scanning
- **Scanner coverage:** SPF, DKIM, DMARC, MX, DNS (A/AAAA), TLS/STARTTLS
- **Input:** domain name string
- **Output:** `EngineReport` with per-scanner `ScannerResult` (passed, scoreWeight, rawData, flags)
- **Constraint:** All scans must be deterministic — same input, same output
- **Status:** IMPLEMENTED (engine scanners: DNS, SPF, DKIM, DMARC, MX use DoH; TLS uses node:dns + TCP :25; Blacklist uses node:dns)

### FR-2: Domain Reputation Scanning
- **Scanner coverage:** IP blacklist (DNSBL), domain blacklist (DBL)
- **Input:** domain (and resolved IPs for IP blacklist)
- **Output:** `isListed: boolean`, `listedOn: string[]`
- **Status:** PARTIAL — engine has `BlacklistScanner` (domain-only DBL); worker has IP RBL scanner (not yet migrated to engine)

### FR-3: Scoring and Risk Assessment
- **Formula:** `100 - Σ(scoreWeight for failed scanners)`, floored at 0
- **Risk levels:** LOW (≥90), MEDIUM (≥70), HIGH (≥40), CRITICAL (<40)
- **Status:** IMPLEMENTED (engine scoring, `EngineOrchestrator.calculateGlobalScore`)

### FR-4: AI-Assisted Recommendations
- **Scope:** Flag-based deterministic recommendations mapping scanner findings to actionable advice
- **Interface:** `AiProvider.analyze(report) → AiRecommendation[]`
- **Status:** IMPLEMENTED (HeuristicAiProvider — deterministic, no LLM)

### FR-5: Report Generation
- **ReportModel:** Versioned immutable evidence snapshot (metadata, executive summary, authentication/infrastructure sections, recommendations, technical appendix)
- **Status:** IMPLEMENTED (`ReportBuilder.build()` produces `ReportModel` with `metadata.version = '1.0.0'`)

### FR-6: Scan Persistence
- **Schema:** `ScanReport` (id, domainId, score, riskLevel, reportModel Json, createdAt)
- **Status:** NOT IMPLEMENTED — Prisma schema exists, but no runtime writes/reads

### FR-7: Domain Management
- **CRUD:** Create/list/delete domains within a workspace
- **Status:** NOT IMPLEMENTED — schema supports it, no API exists

### FR-8: Dashboard
- **Scope:** Aggregate health view, domain list with scores, incident counts
- **Status:** STUB — hardcoded demo data, no DB connection

### FR-9: Webhook Ingestion
- **Scope:** Receive ESP webhook events (bounce, complaint, delivery, open), normalize, persist
- **Status:** STUB — Fastify receives, BullMQ enqueues, worker processes nothing

### FR-10: Export (PDF/CSV)
- **PDF:** Render `ReportModel` as a styled PDF document
- **CSV:** Export scan history as CSV
- **Status:** STUB — `@react-pdf/renderer` installed but unused; ReportGenerator returns fake data

---

## 7. Security Requirements

| Requirement | Status | Priority |
|---|---|---|
| No hardcoded credentials | **VIOLATED** — NextAuth has `admin@inboxshield.ai` / `test` | Critical (Phase 1) |
| SSRF defense on scan endpoint | **NOT IMPLEMENTED** | Critical (Phase 0 P0-08) |
| Domain input validation | **NOT IMPLEMENTED** (empty-domain check only) | Critical (Phase 0 P0-08) |
| Rate limiting per domain/workspace | **NOT IMPLEMENTED** | Critical (Phase 0 P0-08 dev; Phase 1 prod) |
| No error.message leakage on 500 | **VIOLATED** — `error.message` returned directly | Critical (Phase 0 P0-08) |
| Session-based auth on all routes | **NOT IMPLEMENTED** | Critical (Phase 1) |
| RBAC / workspace isolation | **NOT IMPLEMENTED** | Deferred to multi-user phase |
| Secrets in env vars only | **COMPLIANT** (no secrets in source) | — |

---

## 8. Evidence / Remediation Requirements

- Every scanner must produce a `ScannerResult` with deterministic `passed`, `scoreWeight`, `rawData`, and `flags`
- `ReportModel` is the immutable evidence snapshot — once built, never mutated
- `ScanReport.reportModel` (JSON in PostgreSQL) is the persistence record of an evidence snapshot
- Recommendations must be grounded in scanner findings — never fabricated
- Before/after comparison requires two `ScanReport` records for the same domain at different times

---

## 9. SaaS / Agency Requirements

- Multi-workspace architecture (Workspace → Domain → ScanReport)
- Per-workspace rate limiting
- Client portal (later): white-labeled domain status for agency clients
- White-label capability (later): custom branding per workspace
- API key management for programmatic access (later)

---

## 10. Acceptance Criteria (for V1 to be considered shippable)

| Criterion | Verification |
|---|---|
| All 7+ scanners run deterministically against a real domain | Engine test suite passes |
| `ScanReport` persists to PostgreSQL with full `ReportModel` | Integration test: scan → persist → retrieve → verify reportModel |
| Dashboard shows real scan data from DB | Manual: dashboard loads, displays real scores |
| Domain CRUD works within workspace scope | API test: create domain → list → scan → delete |
| Auth prevents unauthorized access | Manual: unauthenticated request returns 401 |
| No fabricated scanner results anywhere | Audit: grep for `passed: true` in stubs yields zero results |
| `ignoreBuildErrors` is removed | `next.config.ts` verified |
| CI passes all gates | GitHub Actions: build, lint, typecheck, test, prisma validate, audit |

---

*This is the canonical product requirements document. It supersedes `docs/formal/03-Product-Requirements-Document.md` for all authoritative claims. Last verified against repository source: 2026-08-08.*
