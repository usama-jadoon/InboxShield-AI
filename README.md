# InboxShield AI

An enterprise-grade Email Deliverability Intelligence Platform.

InboxShield dynamically routes emails using AI to ensure legitimate messages reach the inbox, while normalizing complex webhooks from major ESPs (AWS SES, SendGrid, Mailgun) into a single actionable dashboard.

## Architecture
Built on a strict Control Plane (Next.js 15) and Data Plane (Node.js/Fastify Worker) architecture to ensure millions of webhooks can be ingested without crashing the UI or hitting serverless limitations.

### Tech Stack
- Next.js 15 (Control Plane / UI)
- Node.js (Data Plane / Webhooks / OmniRoute Engine)
- PostgreSQL & Prisma (Persistent Storage)
- Redis & BullMQ (High-throughput Queuing)
- Tailwind CSS & shadcn/ui

## Getting Started

1. Set up the environment variables:
   `cp .env.example .env`

2. Install dependencies (requires `pnpm` >= 9.0):
   `pnpm install`

3. Generate the Database Client:
   `pnpm turbo run generate`

4. Start development servers:
   `pnpm dev`
