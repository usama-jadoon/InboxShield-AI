# 03. Product Requirements Document (PRD)

**Related Documents:** 
- [04. User Stories](./04-User-Stories.md)
- [05. Feature Specifications](./05-Feature-Specifications.md)
- [10. Security](./10-Security.md)

## 1. Problem Statement
Legitimate, high-volume email senders suffer random deliverability drops because static routing ties them to a single IP/ESP infrastructure. Monitoring health requires deep technical knowledge of DNS, DMARC, and RBLs.

## 2. Target Audience
- **Deliverability Ops:** Managing multiple domains and IP warmup schedules.
- **Growth Marketers:** Ensuring cold outreach bypasses spam filters.
- **Developers:** Wanting an easy REST API to send mail without worrying about ESP rate limits or webhook normalization.

## 3. Functional Requirements (FR)

### FR-01: Modular ESP Integration
The system MUST permit users to add API credentials securely for minimum AWS SES, Mailgun, and SendGrid per connected domain.

### FR-02: OmniRoute Intelligence Engine
The system MUST dynamically route an outbound email based on real-time reputation scoring, recipient ISP (e.g., routing Gmail recipients through Provider A, Outlook through Provider B), and baseline ESP weighting. 

### FR-03: Universal Webhook Normalization
The system MUST expose unique webhook ingress URLs for each ESP, catching their proprietary formats and normalizing them into a universal `EmailEvent` schema (Delivery, Bounce, Open, Click, Complaint).

### FR-04: Infrastructure Scanner Engine
The system MUST scan connected domains regularly for valid SPF, DKIM, DMARC, MX records, TLS certificates, and query Major Real-time Blackhole Lists (RBLs/DBLs).

### FR-05: AI Pre-Flight Payload Checking
The platform MUST allow users to run an email copy/subject through an LLM to receive a "Spam Risk Score" and suggested adjustments before dispatching the campaign.

### FR-06: Strict Multi-Tenant Architecture
The platform MUST securely isolate domains, metrics, and API keys into discrete Workspaces (Tenants) governed by Role-Based Access Control (RBAC).

### *New Requirement* FR-07: Inbound Reply Tracking
The platform MUST support receiving incoming replies via MX records or forwarding to establish true 2-way engagement metrics (crucial for algorithmic reputation building at Google/MS).

## 4. Non-Functional Requirements (NFR)

- **Scalability:** Webhook pipelines must utilize an in-memory queue (Redis/BullMQ) to strictly decouple ingestion from PostgreSQL inserts.
- **Latency:** Outbound API requests via the `/v1/send` endpoint must respond within 150ms.
- **Availability:** The Data Plane (Sending execution and Webhook collection) must achieve 99.99% uptime.
- **Security:** In-transit and At-rest data protections. ESP credentials must be AES-256-GCM encrypted in the database. PII must be hashed or anonymized per GDPR after 90 days.

## 5. Success Metrics
- **Platform Speed:** Ingestion workers process queue jobs in < 50ms average.
- **Bounce Reduction:** Active routing reduces domain bounce rates by >15% over a 30-day window compared to static routing.
