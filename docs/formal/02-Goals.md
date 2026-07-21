# 02. Goals

**Product:** InboxShield AI  

## 1. Business Goals
- **Eliminate Single Points of Failure:** Deprecate reliance on any single ESP. If AWS SES bans an account, outbound operations must continue unhindered via SendGrid/Mailgun within millisecond response times.
- **Achieve Product-Market Fit (SaaS Phase):** Attain a >110% Net Revenue Retention (NRR) by proving to B2B clients that their cold outreach or transactional emails perform 20%+ better through InboxShield than standard SMTP.

## 2. Product Goals
- **Set it and Forget it Infrastructure:** Users should only have to connect their domains and ESP API keys once. Everything else—from RBL scanning to failover routing—must be automated.
- **Unified Telemetry:** Regardless of whether an email was sent via Postmark, SES, or Mailgun, the resulting analytics (Bounce, Delivered, Opened) must render in a unified, beautifully standardized Next.js dashboard.
- **Proactive Threat Mitigation:** Warn users *before* they send. AI must evaluate email payloads and recipient lists to flag known spam triggers, acting as a guardrail against user-inflicted reputation damage.

## 3. Technical Engineering Goals
- **Ultra-Low Latency Dispatch:** The API gateway must accept an email, query the Redis reputation cache, execute OmniRoute AI heuristic rules, and dispatch the payload in **< 150ms** at the 95th percentile.
- **Zero-Loss Webhook Ingestion:** Built to consume up to 10,000 asynchronous webhooks per minute from ESPs without dropping data or crashing the Node.js event loop.
- **10-Year Maintainability:** Strict adherence to Clean Architecture. The UI configuration logic is violently decoupled from the core webhook processing queue to ensure high availability and prevent monolithic rot.
