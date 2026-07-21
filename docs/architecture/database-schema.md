# Database Design & Scalability Strategy

**Product Name:** InboxShield AI  
**Document Status:** Approved Draft  
**Role View:** Senior Database Architect  

---

## 1. Architectural Overview & Paradigm
The database acts as the ultimate source of truth for configuration, tenant isolation, and long-term analytical telemetry. Because InboxShield AI deals with high-throughput webhook ingestion, the database must balance strict relational integrity (for configuration/billing) with high-volume append-only operations (for telemetry).

The primary data store is **PostgreSQL**.

---

## 2. Core Entities (Tables)

### 2.1. Tenant (Workspace)
The root bounded context for all data isolation.
- **Fields:** ID, Name, Plan Tier, Status (Active, Suspended), Creation Timestamp, Modification Timestamp.

### 2.2. User
Human actors interacting with the Control Plane.
- **Fields:** ID, Tenant_ID, Email, Password Hash, Role (Owner, Admin, Viewer), Timestamps.

### 2.3. ApiKey
Machine authentication for the Data Plane Dispatch API.
- **Fields:** ID, Tenant_ID, Key Hash, Key Prefix (for display), Last Used Timestamp, Timestamps.

### 2.4. Domain
Verified sending domains registered by the Tenant.
- **Fields:** ID, Tenant_ID, Domain Name (e.g., mail.example.com), SPF Status, DKIM Status, DMARC Status, Health Score, Timestamps.

### 2.5. EspAccount
Connected external ESPs utilized dynamically by OmniRoute.
- **Fields:** ID, Tenant_ID, Provider (Enum: SES, SendGrid, etc.), Encrypted Credentials, Base Weight, Status (Active, Paused, Restricted), Timestamps.

### 2.6. EmailMessage (Telemetry Parent)
Record of a dispatch attempt. Extremely high volume.
- **Fields:** ID, Tenant_ID, Domain_ID, EspAccount_ID, Recipient Domain (normalized, e.g., "gmail.com" for fast ISP grouping), Recipient Hash (PII protection), Subject, Dispatch Status, OmniRoute Decision Flags, Timestamp.

### 2.7. EmailEvent (Telemetry Child)
Asynchronous events received mapped to a dispatched message. Highest volume.
- **Fields:** ID, Tenant_ID, EmailMessage_ID, Provider Event ID (from ESP), Event Type (Delivered, Bounced, Complained, Opened), Bounce Reason/Code, Occurred At Timestamp.

---

## 3. Relationships

- **Tenant is the Root:** `User`, `ApiKey`, `Domain`, `EspAccount`, `EmailMessage`, and `EmailEvent` all maintain a Many-to-One relationship to `Tenant`. Injecting `Tenant_ID` into all deep child tables avoids expensive multi-table JOINs for simple workspace-filtered reads.
- **1-to-Many Connections:**
  - One `Tenant` has Many `Domains` and `EspAccounts`.
  - One `EmailMessage` has Many `EmailEvents` (e.g., A message can be "Delivered" and later "Opened" and later "Complained").
  - `EmailMessage` Belongs-To one `Domain` and one `EspAccount`.

---

## 4. Indexing Strategy

To support lightning-fast inserts and read-heavy analytics dashboards without locking tables, careful index planning is required:

- **Primary Keys:** Clustered indexes on sequentially sortable IDs (UUIDv7 or CUID2). Random UUIDv4s are avoided to prevent index fragmentation and page-thrashing in PostgreSQL under heavy write loads.
- **Tenant Filtering:** B-Tree Indexes on `Tenant_ID` across all operational and structural tables.
- **Authentication:** Hash Index or exact-match B-Tree on `ApiKey.Key_Hash` for rapid machine validation.
- **Idempotency Locks:** Unique Compound Index on `EmailEvent (Provider_Event_ID, EspAccount_ID)` to safely drop duplicate webhook deliveries from ESPs at the database level.
- **Analytics Lookups:** 
  - Compound Index on `EmailMessage (Tenant_ID, Created_At) DESC` for charting timelines.
  - Index on `EmailMessage.Recipient_Domain` for OmniRoute's historical performance aggregations.

---

## 5. Constraints & Data Integrity

- **Foreign Keys:**
  - Strict `RESTRICT` deletion on `EspAccount` and `Domain` if `EmailMessages` exist mapping to them. This prevents orphaned telemetry records mapping to null configurations.
  - `CASCADE` deletion exclusively from `Tenant` to wipe a workspace via a background job entirely.
- **Uniqueness:**
  - `User.Email` must be globally unique.
  - `Domain.Name` must be globally unique (prevents two tenants claiming the same domain, mitigating domain routing hijacks).
- **Not Null:**
  - Strict enforcement. Optional data belongs in a normalized JSONB metadata column for `EmailMessage` if external headers must be preserved arbitrarily, keeping the strict column footprint tight.

---

## 6. Future Scalability Plan

- **Data Partitioning strategy:** `EmailMessage` and `EmailEvent` tables will grow by millions of rows daily for enterprise clients. We will implement PostgreSQL Declarative Partitioning on the `Timestamp` column by Month. 
- **Cold Storage Tiering:** Queries requesting logs older than 90 days will be shifted off Postgres. A background worker will ETL older partitions to AWS S3 (Parquet format) and queried via DuckDB or AWS Athena when a user requests deep historical exports.
- **Read Replicas:** The Next.js Control Plane dashboard will point strictly to Read-Replicas to generate complex analytical charts, entirely isolating heavy sequential scans from the Data Plane's primary Write instance.

---

## 7. Prisma Considerations & Limitations

- **Connection Exhaustion:** Serverless environments (Next.js) spawn massive connection counts. Prisma must connect via **PgBouncer** (pooling) or **Prisma Accelerate** to prevent PostgreSQL from hitting connection limits and crashing.
- **Partitioning Abstraction:** Prisma natively does *not* support declarative table partitioning. Initial migrations for `EmailMessage` and `EmailEvent` must utilize `prisma db execute` to run raw raw SQL `CREATE TABLE ... PARTITION BY RANGE` commands. Prisma will simply target the parent table as standard models.
- **Bulk Inserts:** For Webhook ingestion, leveraging Prisma's `createMany` is critical to batch ingest events from BullMQ workers (e.g., flushing 500 events every second into the DB in a single transaction).
- **PII / Column Encryption:** Prisma Client Extensions will be configured as middleware to transparently encrypt and decrypt `EspAccount.Credentials` before hitting the database, fulfilling exact at-rest AES-256 compliance standards without littering service code.