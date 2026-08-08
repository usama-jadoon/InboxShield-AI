# InboxShield AI — Database Schema

**Version:** 1.0 (Canonical)
**Date:** 2026-08-08
**Status:** Baseline — schema changes in Phase 0 and V1 must reconcile against this document
**Authority:** Second only to executable `packages/db/prisma/schema.prisma`; supersedes `docs/formal/09-Data-Model.md`

---

## 1. Source of Truth

The **only** authoritative schema definition is `packages/db/prisma/schema.prisma`. This document is a human-readable rendering of that file plus the target state for V1 — the target state is explicitly **PLANNED**, never described as already implemented.

Validation status of the current file:

| Check | Result |
|---|---|
| `prisma validate` | ✅ PASSES (verified 2026-08-08) |
| `prisma generate` | ❌ Untested — `@inboxshield/db` package has a broken export |
| Migration files | ❌ None exist (`prisma/migrations/` empty) — P0-03 must generate the initial migration baseline |

---

## 2. CURRENT SCHEMA (implemented — verified against `schema.prisma`)

### 2.1 Workspace

```
model Workspace {
  id        String   @id @default(cuid())
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  domains   Domain[]
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key, generated |
| `name` | `String` | Workspace display name |
| `createdAt` | `DateTime` | Defaults to now |
| `updatedAt` | `DateTime` | Auto-updated by Prisma |
| `domains` | `Domain[]` | Reverse relation |

**Purpose:** Tenant root of the multi-workspace (agency) model. Every `Domain` belongs to exactly one `Workspace`.

### 2.2 Domain

```
model Domain {
  id          String   @id @default(cuid())
  domainName  String   @unique

  workspaceId String
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  reports     ScanReport[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key, generated |
| `domainName` | `String` **@unique** | Domain name is globally unique — one Domain row per domain across the platform |
| `workspaceId` | `String` | FK → `Workspace.id` |
| `workspace` | Relation | `onDelete: Cascade` — deleting a workspace deletes its domains |
| `reports` | `ScanReport[]` | Reverse relation |
| `createdAt` | `DateTime` | Defaults to now |
| `updatedAt` | `DateTime` | Auto-updated |

**Note:** `domainName` uniqueness is platform-wide (no composite key with `workspaceId`). Two workspaces cannot monitor the same domain name as separate rows. This is a deliberate current-state decision recorded here for visibility — it is the kind of constraint V1 should revisit.

### 2.3 ScanReport

```
model ScanReport {
  id          String   @id @default(cuid())
  domainId    String
  domain      Domain   @relation(fields: [domainId], references: [id], onDelete: Cascade)

  score       Int      // 0-100
  riskLevel   String   // LOW, MEDIUM, HIGH, CRITICAL

  reportModel Json     // IMMUTABLE SNAPSHOT: The complete ReportModel JSON

  createdAt   DateTime @default(now())

  @@index([domainId, createdAt(sort: Desc)])
  @@index([createdAt(sort: Desc)])
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | Primary key, generated |
| `domainId` | `String` | FK → `Domain.id` |
| `domain` | Relation | `onDelete: Cascade` |
| `score` | `Int` | 0–100 deterministic score from `EngineOrchestrator.calculateGlobalScore()` |
| `riskLevel` | `String` | One of `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `reportModel` | `Json` | **IMMUTABLE SNAPSHOT** — the serialized `ReportModel` (evidence contract v1.0.0) |
| `createdAt` | `DateTime` | Defaults to now |

**Indexes:**
- `@@index([domainId, createdAt(sort: Desc)])` — fast per-domain scan history queries
- `@@index([createdAt(sort: Desc)])` — recent-scans / dashboard queries

### 2.4 Relationships Diagram (current)

```
Workspace (1) ──< Domain (N) ──< ScanReport (N)
   id             id                 id
   name           domainName         score
   createdAt      workspaceId        riskLevel
   updatedAt      createdAt          reportModel (Json)
                 updatedAt          createdAt
```

### 2.5 Current Schema Invariants

1. **`ScanReport.reportModel` is immutable.** Once written, it is never mutated in place. A re-scan creates a *new* `ScanReport` row. This is what makes before/after comparison possible.
2. **`score` and `riskLevel` are derived values frozen at scan time.** They are never recomputed from `reportModel` after write.
3. **Deletes cascade:** workspace → domains → reports.
4. **No migration files exist.** The schema is valid but the database has never been migrated (no `prisma/migrations/`).

---

## 3. TARGET SCHEMA (PLANNED for V1 — NOT implemented)

The models below are the **target** data model for V1. None of them exist in `schema.prisma` today. They are documented here so that every future schema PR can be compared against this target. Nothing in this section describes an existing system.

### 3.1 Planned Additions (V1)

| Model | Purpose | Added in |
|---|---|---|
| `User` | Authenticated platform user | V1 — real auth |
| `Account` | OAuth account link (NextAuth) | V1 — real auth |
| `Session` | Session storage (NextAuth) | V1 — real auth |
| `VerificationToken` | Email verification (NextAuth) | V1 — real auth |
| `WorkspaceMember` | Membership join-table (user ↔ workspace) | V1 — multi-user workspaces |
| `EmailEvent` | Normalized ESP webhook events (bounce, complaint, delivery, open) | V1 — real webhook processing |
| `ApiKey` | Programmatic API access (later) | Deferred to post-V1 |

### 3.2 Planned Target Model Shapes (DRAFT — not finalized)

```
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  passwordHash  String?            // only if credentials provider used
  emailVerified DateTime?
  image         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  workspaces    WorkspaceMember[]
  accounts      Account[]
  sessions      Session[]
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  workspaceId String
  userId      String
  role        String   // OWNER | ADMIN | MEMBER (future RBAC)
  createdAt   DateTime @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([workspaceId, userId])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model EmailEvent {
  id            String   @id @default(cuid())
  domainId      String
  domain        Domain   @relation(fields: [domainId], references: [id], onDelete: Cascade)

  eventType     String   // BOUNCE | COMPLAINT | DELIVERY | OPEN
  esp           String   // sendgrid | ses | mailgun | ...
  messageId     String?
  sender        String?
  recipient     String?
  payload       Json     // raw normalized event
  receivedAt    DateTime @default(now())

  @@index([domainId, eventType])
  @@index([receivedAt(sort: Desc)])
}
```

### 3.3 Schema Evolution Constraints

1. All new models must be additive — never break the existing `Workspace → Domain → ScanReport` chain.
2. `ScanReport.reportModel` continues to carry the immutable evidence snapshot; no schema change may store scanner data outside it.
3. Workspace scoping must be enforced at the query layer (every `Domain` query scoped by `workspaceId`).
4. Migration baseline (P0-03) is generated from the current 3-model schema before any V1 additions.
5. V1 additions require a new Prisma migration, not a schema rewrite.

---

## 4. Database Access Layer

### 4.1 Current State (broken package)

- `packages/db/package.json` declares `"main": "index.ts"` — but **no `index.ts` exists** in the package root.
- This means `@inboxshield/db` cannot be imported at runtime by `apps/web` or `apps/worker`.
- The Prisma schema is valid, but there is no working code to create/read/update/delete data.

### 4.2 Target State (V1)

- `packages/db` exports a PrismaClient singleton and typed service functions (e.g., `saveScanReport()`, `getDomain()`, `listReports()`).
- Services are the only layer that touches Prisma models directly.
- `apps/web` and `apps/worker` depend on `@inboxshield/db` services — they never call `new PrismaClient()` themselves.

---

## 5. Conventions

| Convention | Rule |
|---|---|
| IDs | `cuid()` generated by Prisma |
| Timestamps | `createdAt` / `updatedAt`; `createdAt` defaults `now()`, `updatedAt` uses `@updatedAt` |
| FK relations | Always declare explicit relation fields (both sides) |
| Cascade deletes | Explicit `onDelete: Cascade` on owning relations |
| Immutable evidence | `reportModel Json` written once, never mutated |
| Indexes | Add `@@index` on every FK that is queried as a filter |
| Enums | Use `String` with documented allowed values (Prisma `enum` is an option; current schema uses strings) |

---

*This is the canonical database schema document. It supersedes `docs/formal/09-Data-Model.md` for all authoritative claims. Last verified against repository source: 2026-08-08.*
