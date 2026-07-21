# 10. Security & Compliance

## Threat Model Mitigation

### 1. The Poisoned Tenant (Abuse Prevention)
- **Risk:** A malicious actor signs up, adds an ESP, and blasts a phishing campaign. InboxShield gets banned upstream.
- **Mitigation:** O‍mniRoute AI runs a pre-flight heuristic on all new tenant outbound traffic. Sudden spikes in bounce rates (>5% within 10 minutes) automatically invoke a `CIRCUIT_TRIP` state, revoking the tenant's sending API keys instantly.

### 2. Provider Credential Harvesting
- **Risk:** Database dump exposes raw AWS SES and SendGrid API keys belonging to our clients.
- **Mitigation:** Prisma Client Extensions acting as middleware. All `credentials` written to the `EspAccount` table are encrypted in-memory using `aes-256-gcm` before persisting to Postgres. The central `ENCRYPTION_KEY` is maintained entirely out-of-band in Vercel/AWS Secrets Manager.

### 3. Log Ingestion Overload (DDoS)
- **Risk:** A competitor deliberately hits our Webhook endpoints with millions of fake generic payloads to bankrupt our infrastructure or OOM Redis.
- **Mitigation:** Strict Fastify route validations using Zod. Cryptographic signature validation on the incoming headers (e.g., verifying `X-Mailgun-Signature` before accepting the payload into the queue).

## Standard Compliance Rules
- **GDPR / CCPA:** PII (`recipientHash`) within `EmailMessage` logs must map to an anonymizing function after a configured retention window (e.g. 90 days), replacing the local-part of the email with `[REDACTED]`.
- **Authentication:** Control Plane access utilizes NextAuth.js configured strictly with `HttpOnly` secure session cookies, entirely negating XSS token theft vectors.
