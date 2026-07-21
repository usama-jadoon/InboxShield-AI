# Master Strategy & Technical Roadmap (10-Year Vision)

**Product Name:** InboxShield AI  
**Document Status:** Pending CTO & Stakeholder Approval  

---

## 1. Critical Analysis of the Idea
InboxShield AI is solving a massive problem. ESPs (SendGrid, SES) are commodities, but *deliverability* is a dark art. Building a middleware layer that abstracts infrastructure and uses AI to mathematically guarantee the highest inbox placement is a billion-dollar concept.

**However, the fundamental challenge is the protocol itself.** 
Email is archaic. ESPs return messy, non-compliant webhook payloads. Dealing with latency, attachments, and sudden traffic spikes requires extreme resilience. If our API drops outbound emails, or if our ingestion queues fail to track bounces, our platform is actively worse than using SES directly. 

## 2. Identified Missing Requirements
1. **Inbound Reply Tracking:** The PRD assumes outbound and webhooks only. To calculate true "engagement," we need to track incoming replies (a massive positive signal for providers like Google). Do we ingest inbound MX traffic?
2. **Attachment Handling:** Email payloads with large attachments (e.g., 20MB PDFs) will choke a Redis Queue if we buffer the entire payload in-memory. We need an object-storage streaming solution (S3 buffer) for attachments before queuing.
3. **Abuse Prevention (Critical):** If an internal user or a SaaS tenant sends a phishing campaign through *our* platform, AWS/SendGrid will ban our root accounts. We need **outbound spam filtering** before the email leaves our Data Plane.
4. **Data Retention & GDPR:** Telemetry logs contain PII (Emails). We need an automatic obfuscation layer after X days, leaving only aggregate domains (`user123@gmail.com` -> `[REDACTED]@gmail.com`).

## 3. Recommended Improvements & Alternative Architecture Challenge
- **The Challenge:** While Node.js is great for I/O, AI evaluations (regex parsing, synchronous heuristics, OpenAI API latency) can block the Node.js Event Loop. If the event loop is blocked, the server drops incoming webhooks from ESPs.
- **The Solution:** We must adopt a **Multi-Worker Node.js Strategy** or microservices. 
    1. **Ingress API (Fastify):** Does NOTHING but accept payloads, validate auth, and push to Redis. (Extremely fast, never blocks).
    2. **OmniRoute Processor (Node/Python):** Pulls from Redis, runs AI/heavy calculations, and dispatches.
    - *Future 3-Year Vision:* Rewrite the specific Ingress Gateway in **Rust** or **Go** for zero-cost abstraction and predictable memory usage under millions of requests. For now, Fastify + Node is acceptable, provided we separate ingestion from processing.
- **Protocol Support:** Initially support REST API. In Phase 2, we *must* support standard SMTP ingress (acting as an SMTP relay) so legacy CRMs can use us without code changes.

## 4. Complete Documentation Structure
To maintain this for 10 years, we will implement this enterprise structure:
```text
/docs
├── 00-master-plan.md            # You are here (Mission, Roadmap, High-level)
├── product/
│   ├── PRD.md                   # Product specs, stories, targets
│   └── metrics.md               # KPI definitions
├── architecture/
│   ├── system-design.md         # Control vs Data plane, component diagrams
│   ├── database-schema.md       # Table definitions and migration strategies
│   └── security-compliance.md   # SOC2/GDPR, encryption, abuse prevention
├── engineering/
│   ├── coding-standards.md      # DRY, SOLID, strict TS, styling
│   └── testing-strategy.md      # Unit, Integration, E2E playbooks
└── operations/
    ├── deployment-guide.md      # CI/CD, Docker, Vercel
    └── runbooks.md              # Incident response, DLQ manual processing
```
*(Note: Existing docs will be reorganized into this structure).*

---

## 5. Phased Milestones & Roadmap

| Phase | Milestone | Description | Est. Time |
|---|---|---|---|
| **M1** | **Foundation & Control Plane** | Monorepo setup, Next.js dashboard, Auth, Postgres schema, workspace isolation. | Weeks 1-2 |
| **M2** | **Data Plane Core (Ingress)** | Fastify server, Redis + BullMQ pipelines, basic direct dispatch to SES/SendGrid without AI. | Weeks 3-4 |
| **M3** | **Webhook & Telemetry Layer** | Standardizing incoming webhooks, writing to DB, exposing metrics to Next.js API. | Week 5 |
| **M4** | **OmniRoute V1 (Heuristics)** | Routing engine using historical DB data / Redis reputation cache to pick routes. | Weeks 6-7 |
| **M5** | **Security & Scanner Engine** | DNS compliance, RBL checks, outbound spam payload scanning. | Week 8 |
| **M6** | **OmniRoute V2 (AI Payload Check)**| Connecting LLMs for pre-send sentiment/spamminess checks. | Phase 2 |

---

## 6. Open-Source Library Recommendations (and WHY)

- **Backend Web Server:** `Fastify`
  - *Why:* ~20-30% faster than Express.js, native JSON schema validation (extremely fast), perfect for our high-throughput Webhook Ingress.
- **Message Queue:** `BullMQ` (backed by Redis)
  - *Why:* Enterprise-grade queue for Node.js. Built-in concurrency control, delayed jobs (crucial for email warmup pacing), and robust retry/DLQ mechanics.
- **Validation:** `Zod`
  - *Why:* Strict TypeScript bounds checking. We cannot trust any payload from an external ESP webhook or client API.
- **ORM / Database:** `Prisma` + `PgBouncer`
  - *Why:* Superior developer experience and type safety. *Caveat:* Prisma is heavy; we must use PgBouncer to manage connection pooling so background workers don't crash the DB.
- **Email Assembly:** `Nodemailer` + `mailparser`
  - *Why:* The battle-tested standard for compiling proper MIME standard emails and parsing raw email bodies safely.
- **Architecture Enforcement:** `eslint-plugin-boundaries`
  - *Why:* To enforce Clean Architecture programmatically. Prevents the frontend from accidentally importing backend services, and enforces domain separation.

---

## 7. Major Risks & Mitigation
1. **Risk:** Redis Out Of Memory (OOM). If our dispatch workers fail, webhooks will pile up in BullMQ and crash Redis, resulting in permanent data loss.
   - *Mitigation:* Implement strict TTLs on logs. If queue depth > X, trigger alerts and auto-scale workers.
2. **Risk:** Blacklisting of our Root IPs due to bad actors.
   - *Mitigation:* We must build rate limits and a "Quarantine" phase for all new Tenants where their outbound traffic is heavily scrutinized and volume-capped.

## 8. Strategic Questions for You
To finalize the requirements, I need your input:
1. **SMTP vs API:** Will external applications send emails to us via a REST API payload, or do we need to operate an actual SMTP Relay server (`smtp.inboxshield.com:587`)?
2. **Attachments:** Will we accept email payloads with large attachments? (This dramatically changes our memory/storage queuing strategy).
3. **Inbound Mail:** Are we tracking incoming user replies, or solely measuring outward delivery/bounces?