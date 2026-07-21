# Security & Compliance Strategy

**Product Name:** InboxShield AI

## 1. Threat Model & Abuse Prevention
The highest risk to an email deliverability platform is its own users. If a malicious tenant sends phishing campaigns, the upstream ESPs (SES, SendGrid) will ban InboxShield's root accounts, causing an outage for *all* legitimate tenants.

**Mitigation: Outbound Spam Pipeline**
1. **New Tenant Quarantine:** All new tenants are restricted in volume (e.g., max 500 emails/day).
2. **AI Content Scanning:** Before leaving the Dispatch Gateway, a sample of text/HTML payloads are run through an internal heuristic (and optionally an LLM) looking for phishing signals (crypto, password resets from unverified domains).
3. **Automated Banning:** If bounce limits exceed 10% or complaints exceed 0.5% in a rolling 1-hour window, the API automatically revokes the tenant's API keys and pauses routing.

## 2. Platform Security
- **Authentication:** NextAuth.js configured with strict session invalidation and CSRF protection.
- **Machine Auth:** Tenant API keys are hashing using SHA-256 before database insertion. The raw key is *only* shown once upon creation.
- **Tenant Data Isolation:** PostgreSQL Row-Level Security (RLS) is evaluated for the Control Plane. Alternatively, strict application-level `Tenant_ID` `WHERE` clauses enforced via Prisma middleware.

## 3. Data Encryption & PII
- **ESP Credentials:** Customer API keys for Mailgun, SES, etc., are symmetrically encrypted at rest via AES-256-GCM. The decryption key exists solely as an environment variable in the Data Plane.
- **Recipient Data (PII):** Email addresses in the `EmailLog` are considered PII. 
  - To comply with GDPR Right to be Forgotten, email addresses are stored normally but can be scrubbed dynamically via a background worker after a 90-day retention policy.
  - Optional toggle to store only SHA-256 hashes of recipient emails for ultra-secure tenants.

## 4. API Security
- **Rate Limiting:** Token Bucket algorithm implemented in Redis. Standard API keys limited to 1,000 req/min depending on tenant tier.
- **Payload Constraints:** Strict byte-size constraints on inbound JSON payloads (e.g., max 5MB) enforced via Fastify to prevent memory exhaustion attacks.