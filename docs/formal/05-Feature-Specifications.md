# 05. Feature Specifications

## Feature: OmniRoute AI Engine

### Description
The core routing algorithm replacing static SMTP decision-making. Evaluates outbound email payload dimensions against historical telemetry to mathematically determine the path of highest probable inbox delivery.

### Input Parameters
1. **Recipient Domain:** Evaluated to identify the controlling ISP (e.g., detecting if `client.abc.com` is hosted by Google or Office365 by checking MX records locally).
2. **Current Tenant ESPs:** Fetch the list of active ESP connections (SES, SendGrid) from the DB.
3. **Reputation Matrix (Redis):** Pulls the rolling 24-hour delivery success metric for `[ESP_ID] -> [ISP_ID]`.
4. **Blacklist Penalties:** Flags indicating if current IPs assigned to the ESP are blacklisted.

### Fallback Logic (Circuit Breaker)
1. **Primary Evaluation:** If SES yields a 99% success rate to Gmail, select SES.
2. **Failure Event:** Attempt dispatch. ESP returns a HTTP 5xx or `429 Too Many Requests`.
3. **Circuit Trigger:** The API immediately records the failure in Redis and selects the next highest-scoring ESP (e.g., Mailgun).
4. **Execution:** Dispatches payload through Mailgun. Client receives standard `202 Accepted`. Total penalty to latency: < 50ms.

---

## Feature: Webhook Ingestion & Normalization

### Description
Different ESPs provide completely wild JSON schemas for event callbacks. InboxShield normalizes them into one source of truth.

### Workflow
1. **Ingress:** ESP POSTs to `https://api.inboxshield.ai/v1/webhooks/aws-ses`.
2. **Queue Drop:** Fastify validates the cryptographic signature (to ensure it actually came from AWS) and immediately pushes the raw payload to BullMQ. `HTTP 200 OK` is returned to AWS.
3. **Worker Processing:** Node.js worker pulls the job. It maps AWS's `notificationType: "Bounce"` and `bounce.bouncedRecipients[0].diagnosticCode` to InboxShield's internal schema.
4. **Persistence & Cache Update:** The worker writes the normalized `EmailEvent` row to PostgreSQL and increments the Redis Reputation Matrix to tell OmniRoute that this specific pathway just lost a point.

---

## Feature: AI Payload Check

### Description
Preventative scanning of outbound text to protect tenant sending reputation.

### Implementation
- **Trigger:** Manual via UI or enforced via Tenant settings.
- **Action:** Sends Subject + HTML Body + Plaintext Body to an LLM (e.g., OpenAI `gpt-4o-mini`).
- **Prompt Logic:** Analyzes text for common spam signals (financial promises, urgent demands, excessive links, crypto keywords). Returns structured JSON with a `spam_score_1_to_100` and an array of `violating_sentences` with suggested rewrites.
