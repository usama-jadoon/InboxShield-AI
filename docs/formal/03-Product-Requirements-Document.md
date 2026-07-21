# 03. Product Requirements Document (PRD)

## 1. Problem Statement
Legitimate, high-volume email senders suffer random deliverability drops because static routing ties them to a single IP/ESP infrastructure. Monitoring health requires deep technical knowledge of DNS, DMARC, and RBLs.

## 2. Target Audience
- **Deliverability Ops:** Managing multiple domains and IP warmup schedules.
- **Growth Marketers:** Ensuring cold outreach bypasses spam filters.
- **Developers:** Want an easy REST API to send mail without worrying about ESP rate limits or webhook normalization.

## 3. Functional Requirements (FR)

### FR-01: ESP Integration
The system MUST permit users to add API credentials for multiple external providers (AWS SES, Mailgun, SendGrid) per connected domain.

### FR-02: OmniRoute Engine
The system MUST dynamically decide which ESP to route an outbound email through based on real-time reputation scoring, recipient ISP (e.g., routing Gmail recipients through Provider A because it has higher historical success, and Outlook through Provider B).

### FR-03: Webhook Normalization
The system MUST expose unique webhook ingress URLs for each ESP, catching their proprietary JSON formats and normalizing them into a universal `EmailEvent` schema (Delivery, Bounce, Open, Click, Complaint) attached to the original `EmailMessage`.

### FR-04: Infrastructure Scanner
The system MUST automatically scan connected domains every X hours for valid SPF, DKIM, DMARC, MX records, and query Major Real-time Blackhole Lists (RBLs/DBLs).

### FR-05: AI Payload Checking
The platform MUST allow users to run an email copy/subject through an AI API (OpenAI/Anthropic) to receive a "Spam Risk Score" and suggested adjustments before dispatching the campaign.

### FR-06: Multi-Tenant Architecture
The platform MUST securely isolate domains, metrics, and API keys into discrete Workspaces (Tenants) governed by Role-Based Access Control (Admin, Viewer).

## 4. Non-Functional Requirements (NFR)

- **Scalability:** The webhook pipeline must utilize an in-memory queue (Redis/BullMQ) to decouple ingestion from PostgreSQL inserts.
- **Latency:** Outbound API requests must respond within 150ms.
- **Availability:** The Data Plane must achieve 99.99% uptime.
- **Security:** ESP credentials must be AES-256-GCM encrypted in the database. Raw decrypted keys are injected into memory only at the moment of dispatch.

## 5. Success Metrics
- **Platform Speed:** Ingestion workers process queue jobs in < 50ms average.
- **Bounce Reduction:** Active routing reduces domain bounce rates by >15% over a 30-day window compared to static routing.
