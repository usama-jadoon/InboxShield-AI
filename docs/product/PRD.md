# Product Requirements Document (PRD)

**Product Name:** InboxShield AI
**Document Status:** Draft / Under Review
**Last Updated:** 2026-07-21

---

## 1. Vision
To become the undisputed enterprise standard in email deliverability intelligence. InboxShield AI empowers organizations to dynamically route emails using artificial intelligence, ensuring every legitimate message reaches the inbox, predicting deliverability metrics in real-time, and rendering blacklists obsolete. Starting as a powerful internal engine, evolving into a multi-tenant SaaS powerhouse.

---

## 2. Goals

### Business Goals
- **Phase 1:** Successfully deploy for internal teams to stabilize current outreach and marketing campaigns, reducing dependency on a single points-of-failure (e.g., a single ESP ban breaking all output).
- **Phase 2:** Achieve product-market fit as a B2B SaaS platform for agencies, enterprises, and high-volume senders. 

### Product & Technical Goals
- **Intelligent Routing:** Deploy "OmniRoute AI" to analyze ISP-specific reputation and route traffic dynamically to the most optimal ESP.
- **Fail-safe Infrastructure:** Establish a high-throughput, latency-optimized gateway capable of reliably processing and queueing millions of emails daily.
- **Actionable Telemetry:** Unify event webhooks across fragmented providers (SES, Mailgun, SendGrid) to provide a single, normalized pane of glass for deliverability health.

---

## 3. Target Users

1. **Deliverability Engineers / Ops Managers (Primary):**
   - **Pain Point:** Spending hours manually checking blacklists, analyzing DMARC reports, and shifting traffic when an IP goes bad.
   - **Need:** Automated health monitoring and instant failovers.
2. **Growth / Outreach Leaders (Secondary):**
   - **Pain Point:** Campaigns underperforming because perfectly good copy lands in the spam folder.
   - **Need:** Higher inbox placement, predictable open rates, ROI visibility.
3. **Developers / DevOps (Tertiary):**
   - **Pain Point:** Integrating and maintaining logic for multiple ESP APIs, handling messy webhook data.
   - **Need:** A single clean API to send email, while InboxShield handles the multi-ESP complexities underneath.

---

## 4. User Stories

### Epic 1: Dynamic Routing (OmniRoute AI)
- As a Deliverability Manager, I want to connect multiple ESPs to a single workspace, so that I have a redundant pool of sending IPs.
- As a System, I want OmniRoute AI to evaluate the destination ISP (Google, Microsoft, Yahoo) and local reputation data before dispatch, so that the optimal ESP is chosen for that specific recipient.
- As an Ops Manager, I want the system to automatically fallback to a secondary ESP if the primary hits a spam threshold, so that sending is never completely halted.

### Epic 2: Telemetry & Analytics
- As a Growth Leader, I want a unified dashboard showing my overall sender health, so that I can see my domain reputation at a glance.
- As a User, I want to see real-time bounce and complaint rates separated by ESP, so that I can identify which infrastructure is degrading.

### Epic 3: Platform Management & Tenant Isolation
- As an Admin, I want to invite users with specific roles (Admin, Editor, Viewer), so that I can control who modifies routing rules vs. who only sees reports.
- As a Developer, I want to generate application API keys scoped to an individual tenant, so that I can integrate my internal tools securely.

---

## 5. Functional Requirements

- **FR1: Multi-ESP Integration Core:** The system MUST support connection via API keys to minimum AWS SES, Mailgun, SendGrid, and generic SMTP. 
- **FR2: OmniRoute AI Engine:** The system MUST evaluate incoming API requests and route them based on: Recipient Domain (e.g., gmail.com), Historical Bounce Rates of the connected ESPs, and User-defined weightings.
- **FR3: Unified Webhook Ingestion:** The platform MUST provide a normalized webhook receiver that parses delivery, bounce, open, click, and complaint events from all supported ESPs into a uniform database schema.
- **FR4: DNS Compliance Scanner:** The app MUST perform periodic scans on registered domains to verify SPF, DKIM, and DMARC record validity, displaying warnings if records are malformed.
- **FR5: Multi-Tenant Workspace:** Users MUST be able to create isolated "Workspaces/Tenants". Data, API keys, and ESP connections must be strictly separated at the database level.

---

## 6. Non-Functional Requirements

- **NFR1: Performance & Latency:** The synchronous email sending API must respond in under **150ms** (p95). OmniRoute decision logic must execute in under **50ms**.
- **NFR2: Scalability:** The webhook ingestion tier must be completely asynchronous (backed by Redis/Queue) and capable of absorbing sudden bursts of up to 10,000 requests per minute without dropping data.
- **NFR3: Security & Encryption:** All ESP credentials and API keys MUST be encrypted at rest using AES-256-GCM. 
- **NFR4: Reliability:** The Data Plane (Sending Gateway) requires 99.99% uptime. It must fail gracefully; if the AI engine is temporarily unavailable, it must fall back to a standard round-robin routing algorithm.
- **NFR5: Compliance:** The architecture must be designed to support GDPR and CCPA. Personally Identifiable Information (PII) like recipient email addresses in logs should have a configured retention policy or be hashed based on user settings.

---

## 7. Future Scope

- **Automated Domain Warmup:** A module that sends automated, conversational emails back and forth between seed accounts to build IP reputation artificially.
- **AI Content Spam-Scoring:** Running the email body through an LLM payload-checker to detect "spammy" language and warn the user before the campaign goes out.
- **Public SaaS Billing & Self-Serve:** Integration with Stripe for tier-based billing (e.g., $99/mo for 100k routing events).
- **Inbox Placement Testing (Seed Lists):** Reporting on whether an email landed in Priority, Spam, or Promotions across 50+ real inboxes.

---

## 8. Acceptance Criteria

**Feature: OmniRoute Routing**
- *Given* an email bound for `user@gmail.com`, 
- *When* the payload hits the Dispatch API, 
- *Then* the system must query the reputation cache, select the ESP with the highest delivery rate specifically to Google servers over the last 24 hours, and send the email through that ESP.

**Feature: Webhook Normalization**
- *Given* a proprietary JSON bounce webhook from AWS SES, 
- *When* InboxShield receives it, 
- *Then* the payload is parsed and stored in the unified `EmailLog` format with a standard `status = BOUNCED` and a normalized bounce code, regardless of SES's JSON structure.

---

## 9. Edge Cases

- **All ESPs Banned/Rate-Limited:** If OmniRoute determines no ESP is healthy or all are enforcing 429 Rate Limits, the system should queue the message (up to a TTL) and trigger a critical alert to the Tenant Administrator.
- **Webhook Desync/Duplication:** ESPs often fire duplicate webhooks. The ingestion pipeline must be idempotent, utilizing unique event IDs provided by the ESP to discard duplicates.
- **Database Unavailability:** If PostgreSQL temporarily goes down, the fast-path queue (Redis) must hold incoming webhooks until the database connection recovers to prevent data loss.
- **AI Model Timeout:** If the AI scoring engine times out, the system must immediately default to static weight-based routing to preserve the <150ms API latency guarantee.

---

## 10. Success Metrics

### Product Metrics
- **Deliverability Uplift:** >20% reduction in bounce and complaint rates for onboarded domains within the first 30 days.
- **Adoption:** Reach 100% internal adoption across all native mail operations before transitioning to external Beta.

### System Metrics
- **Ingestion Reliability:** 0 dropped webhooks across 30 days.
- **System Speed:** Average dispatch latency of < 100ms.
- **AI Accuracy:** OmniRoute's chosen path results in a successful delivery event > 98% of the time.

### Business Metrics (Post-SaaS Launch)
- **Net Revenue Retention (NRR):** > 110%.
- **Churn Rate:** < 3% monthly churn.