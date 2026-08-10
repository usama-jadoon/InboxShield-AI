# InboxShield AI — API Specification

**Version:** 1.0 (Canonical)
**Date:** 2026-08-08
**Status:** Baseline — every endpoint is labeled with its true implementation state
**Authority:** Second only to executable route source; supersedes `docs/formal/08-API.md`

---

## 1. Status Taxonomy

| Label | Meaning |
|---|---|
| **IMPLEMENTED** | Route exists and works as described |
| **PARTIAL** | Route exists but is incomplete (missing auth, persistence, etc.) |
| **PLANNED** | Not implemented — endpoint does not exist (returns 404 today) |

**Rule:** Nothing is labeled IMPLEMENTED unless the executable source proves it. Planned endpoints are never described as working.

---

## 2. Web API (Next.js App Router, port 3000)

### 2.1 `POST /api/scan` — Run deterministic domain scan

**Status:** PARTIAL — exists and works against the engine, but: no auth, no rate limiting, no persistence (returns report inline without DB write), leaks `error.message` on 500.

**Request**
```json
{ "domain": "example.com" }
```

**Response 200**
```json
{
  "report": {
    "domain": "example.com",
    "timestamp": "2026-08-08T12:00:00.000Z",
    "globalScore": 84,
    "riskLevel": "MEDIUM",
    "scannerResults": {
      "auth:spf": { "scannerId": "auth:spf", "passed": true, "scoreWeight": 20, "rawData": {}, "flags": [] },
      "auth:dkim": { "scannerId": "auth:dkim", "passed": false, "scoreWeight": 20, "rawData": {}, "flags": ["DKIM_SELECTOR_NOT_FOUND"] }
    }
  },
  "recommendations": [
    { "id": "...", "title": "Configure DKIM", "severity": "high", "rationale": "...", "evidence": ["..."], "action": "..." }
  ]
}
```

**Response 400**
```json
{ "error": "Domain is required" }
```
(Triggered when `domain` is empty/falsy. No further input validation exists.)

**Response 500**
```json
{ "error": "<raw error.message>" }
```
⚠️ **SECURITY DEFECT:** leaks the underlying error message. Must be replaced with a generic message (P0-08).

**Actual behavior (verified in source):**
- Creates an `EngineOrchestrator` at module scope with all 7 engine scanners (DNS, SPF, DKIM, DMARC, MX, TLS, Blacklist)
- Runs `orchestrator.analyzeDomain(domain)` then `HeuristicAiProvider.analyze(report)`
- Returns `{ report, recommendations }` inline
- **Does NOT write to `ScanReport` in PostgreSQL**

### 2.2 `GET|POST /api/auth/[...nextauth]` — Authentication

**Status:** PARTIAL — route exists (NextAuth v4 handler), but credentials are **hardcoded** `admin@inboxshield.ai` / `test`. This is a critical security violation (per PRD §7).

**Known defect:**
- No database-backed User model
- No OAuth providers
- Hardcoded credential pair in source
- JWT session strategy

**Target (V1):** OAuth (Google/GitHub) providers, DB-backed sessions, middleware route protection.

### 2.3 `GET /api/domains` — List domains in workspace

**Status:** PLANNED — does not exist. `POST` and `DELETE` `/api/domains` also PLANNED.

### 2.4 `GET /api/domains/:id` — Domain detail + scan history

**Status:** PLANNED — does not exist.

### 2.5 Export endpoints

**Status:** IMPLEMENTED (V1-10) — real PDF via `@react-pdf/renderer`, real CSV from scan history.

#### `GET /api/export/pdf`

Workspace-scoped real PDF export of a scan report's immutable `ReportModel` snapshot.

| Query | Type | Required | Description |
|---|---|---|---|
| `domainId` | `string` | yes | Domain id registered in the caller's workspace |
| `scanId` | `string` | no | Specific scan to export; omitted → latest scan for the domain |

- **Auth:** session cookie (`next-auth.session-token`) → workspace resolve → domain ownership check.
- **Responses:** `200` → `application/pdf`, `Content-Disposition: attachment; filename="inboxshield-<domain>-report.pdf"`; `401` unauthenticated; `404` domain not in workspace or no scan report; `500` render failure (generic body, no internal detail leaked).
- **Evidence:** output buffer begins with real `%PDF-` magic bytes (asserted in `src/lib/export/pdf.test.ts`).

#### `GET /api/export/csv`

Workspace-scoped CSV export of scan history (RFC 4180).

| Query | Type | Required | Description |
|---|---|---|---|
| `domainId` | `string` | yes | Domain id registered in the caller's workspace |
| `limit` | `number` | no | Rows to export, default `50`, max `100` |

- **Auth:** session cookie → workspace resolve → domain ownership check.
- **Responses:** `200` → `text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="inboxshield-<domain>-history.csv"`; `401` unauthenticated; `404` domain not in workspace.
- **Columns:** `scanId,score,riskLevel,createdAt` (most-recent-first, RFC 4180 escaping).

---

## 3. Worker API (Fastify, port 3001)

### 3.1 `GET /health` — Liveness probe

**Status:** IMPLEMENTED

**Response 200**
```json
{ "status": "ok", "timestamp": "2026-08-08T12:00:00.000Z" }
```

**Notes:**
- Does not currently verify DB/Redis connectivity (target: health check for DB + Redis per PRD).

### 3.2 `POST /v1/webhooks/:esp` — ESP event ingestion

**Status:** PARTIAL — route works, enqueues to BullMQ, but the worker that processes the queue is a **stub** (logs + sleeps 50ms, no normalization, no DB write).

**Request**
- `esp` path param: `sendgrid` | `ses` | `mailgun` (or any string — no whitelist)
- Body: raw ESP webhook payload (no schema validation)

**Response 200**
```json
{ "received": true }
```

**Actual behavior (verified in source):**
1. Reads `esp` from URL params
2. Enqueues `process-webhook` job to the `webhook-ingestion` queue with `{ esp, rawPayload: request.body }`
3. Returns immediately (avoids ESP latency penalties)
4. Queue: 3 attempts, exponential backoff (1000ms base), `removeOnComplete: true`, `removeOnFail: 1000`

**Gap:** No ESP signature verification, no payload validation, no rate limiting.

### 3.3 Future worker endpoints

| Endpoint | Status |
|---|---|
| `POST /v1/scans` — enqueue scan job | PLANNED |
| `POST /v1/webhooks/:esp` (with signature verification) | PLANNED hardening |

---

## 4. Planned API Surface (V1)

The following is the **target** API surface. None of these exist today.

### 4.1 Domains (workspace-scoped)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/domains` | List domains in current workspace |
| `POST` | `/api/domains` | Create domain `{ domainName }` |
| `DELETE` | `/api/domains/:id` | Delete domain + cascade scan reports |
| `GET` | `/api/domains/:id` | Domain detail with scan history |

### 4.2 Scan

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/scan` | Run scan + persist `ScanReport` to DB (replaces current inline behavior) |
| `GET` | `/api/domains/:id/scans` | List scan history |

### 4.3 Reports & Export

**Implemented endpoints (V1-10):** see §2.5 for full contracts.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/export/pdf?domainId=&scanId=` | PDF export via `@react-pdf/renderer` (real `%PDF-` bytes) |
| `GET` | `/api/export/csv?domainId=&limit=` | CSV export from scan history (RFC 4180) |

### 4.4 Security requirements on all V1 endpoints

- All web routes behind session auth (401 when unauthenticated)
- Rate limited per workspace (`RateLimiter` interface; `LocalMemoryRateLimiter` dev, `RedisRateLimiter` prod)
- SSRF defense on scan targets (block RFC1918/loopback/link-local)
- RFC hostname validation on domain inputs
- No `error.message` leakage on 500

---

## 5. Cross-Cutting Rules

| Rule | Applies to |
|---|---|
| All responses JSON | Web + Worker |
| No raw stack traces in responses | Both |
| `error.message` never leaked on 500 | Web (currently VIOLATED at `/api/scan`) |
| Workspace scoping on every domain query | Web (V1) |
| 401 for unauthenticated access | Web (V1) |
| Generic error for upstream failures | Both (V1) |

---

*This is the canonical API specification. It supersedes `docs/formal/08-API.md` for all authoritative claims. Last verified against repository source: 2026-08-08.*
