# 13. Roadmap

## Phase 1: Foundation (Current)
- Monorepo stabilization (Next.js + Fastify Worker).
- Database schema and Tenant isolations.
- Core DNS/Blacklist Scanner engine implementation.

## Phase 2: The Data Plane
- Fastify Webhook ingress layer for AWS SES and SendGrid.
- BullMQ queue integration and normalization mapping.
- The outbound `POST /v1/send` Gateway setup.

## Phase 3: OmniRoute Intelligence
- Implementing the Redis Reputation Matrix.
- Writing the deterministic fallback circuitry (Round Robin -> Score Routing).
- Initial LLM payload check stubs for Spam/Phishing detection before dispatch.

## Phase 4: Control Plane & Analytics
- Next.js dashboard UI.
- Time-series graphing for millions of normalized webhook logs.
- ESP credential encryption/decryption interface.

## Phase 5: Hardening (SaaS Readiness)
- Automated Warmup Engine (Pacing artificial sending across ESPs to build reputation).
- B2B SaaS Billing Integration (Stripe integration gating tenant sizes).
- Public OpenAPI Documentation for end-users.
