# 07. Database Design

**Engine:** PostgreSQL  
**ORM:** Prisma  

## Core Philosophy
We must separate structural relational data (`Tenant`, `User`, `Domain`) from high-velocity telemetry logs (`EmailMessage`, `EmailEvent`). The latter requires heavy indexing and eventual table partitioning.

## Schema Entities

### Tenant
Root isolation level.
- `id` (cuid)
- `name` (String)
- `status` (Enum: ACTIVE, SUSPENDED)

### User
Human operators.
- `id` (cuid)
- `email` (String, Unique)
- `password_hash` (String)
- `role` (Enum: ADMIN, VIEWER)
- `tenantId` (FK)

### ApiKey
Machine authentication.
- `id` (cuid)
- `prefix` (String) "sk_live_1234"
- `hash` (String) SHA-256 for rapid lookup verification
- `tenantId` (FK)

### Domain
Verified sending domains.
- `id` (cuid)
- `domainName` (String, Unique)
- `spfStatus`, `dkimStatus`, `dmarcStatus` (Enum: PENDING, PASS, FAIL)
- `healthScore` (Float)
- `tenantId` (FK)

### EspAccount
Connected external gateways.
- `id` (cuid)
- `provider` (Enum: SES, SENDGRID, MAILGUN)
- `credentials` (JSONB) **AES-256-GCM Encrypted at rest**
- `tenantId` (FK)

### EmailMessage (Telemetry)
Record of a dispatch intent. High volume insert.
- `id` (cuid)
- `recipientHash` (String) Original PII masked/hashed for compliance.
- `recipientDomain` (String) Indexed. Mapped for OmniRoute (e.g. "gmail.com").
- `omniRouteData` (JSONB) Records *why* OmniRoute picked the path it did for historical auditing.
- `domainId` (FK)
- `espId` (FK)
- `tenantId` (FK)

### EmailEvent (Telemetry)
Asynchronous updates mapped to `EmailMessage`. Highest volume append.
- `id` (cuid)
- `providerEventId` (String) External message-id to guarantee idempotency.
- `eventType` (Enum: SENT, DELIVERED, BOUNCED, COMPLAINED, OPENED, CLICKED)
- `diagnosticCode` (String)
- `messageId` (FK -> EmailMessage)
- `tenantId` (FK)

## Indexing Strategy
- **Idempotency/Duplicate Protection:** Unique Compound Index on `EmailEvent (providerEventId, eventType)`.
- **Analytics Speed:** Compound Index on `EmailMessage (tenantId, createdAt)` to calculate daily volume graph aggregations in milliseconds without arbitrary sequential table scans.
- **Data Partitioning:** We will leverage PostgreSQL Native Declarative Partitioning on `EmailMessage` and `EmailEvent` based on the `createdAt` Timestamp (partitioned by Month) to keep indexes small and write speeds fast.
