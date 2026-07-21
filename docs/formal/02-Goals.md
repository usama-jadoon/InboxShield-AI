# 02. Goals

**Product:** InboxShield AI  

**Related Documents:** 
- [01. Vision](./01-Vision.md)
- [03. Product Requirements](./03-Product-Requirements-Document.md)
- [06. System Architecture](./06-System-Architecture.md)

## 1. Business Goals
- **Eliminate Single Points of Failure:** Deprecate reliance on any single ESP. If AWS SES bans an account, outbound operations must continue unhindered via SendGrid/Mailgun seamlessly.
- **Achieve Product-Market Fit (SaaS Phase):** Attain a >110% Net Revenue Retention (NRR) by proving to B2B clients that their cold outreach or transactional emails perform 20%+ better through InboxShield than standard single-provider SMTP.

## 2. Product Goals
- **Set it and Forget it Infrastructure:** Users should only have to connect their domains and ESP API keys once. RBL scanning, DNS validation, and failover routing must be entirely automated.
- **Unified Telemetry:** Regardless of whether an email was sent via Postmark, SES, or Mailgun, the resulting analytics (Bounce, Delivered, Opened, Replied) must normalize into a strictly unified schema and beautifully standardized dashboard.
- **Proactive Threat Mitigation & Payload Analysis:** AI must evaluate email payloads and recipient lists to flag known spam triggers (acting as a guardrail against user-inflicted reputation damage) *before* campaigns are dispatched.

## 3. Technical Engineering Goals
- **Ultra-Low Latency Heuristic Dispatch:** The API gateway must accept an email, query the Redis reputation cache, execute OmniRoute heuristic rules, and dispatch the payload in **< 150ms** at the 95th percentile. (LLM checks are specifically carved out as async pre-flight drafts to protect this threshold).
- **OOM-Proof Architecture:** Must handle large email payloads (Attachments up to 25MB) using S3 Object Storage buffering rather than holding binary data in memory and crashing Redis queues.
- **Zero-Loss Webhook Ingestion:** Built to consume up to 10,000 asynchronous webhooks per minute without dropping data or crashing the Node.js event loop.
- **10-Year Maintainability:** Strict adherence to Clean Architecture. UI logic (Control Plane) is violently decoupled from the webhook processing queues (Data Plane).
