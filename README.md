# InboxShield AI

An enterprise-grade Deliverability Analysis Engine.

InboxShield makes the spam folder obsolete by providing modular, highly actionable diagnostic intelligence mapping your physical network architecture directly against the strictest modern sender requirements (Google, Microsoft, Yahoo).

![Dashboard Placeholder](docs/assets/dashboard-placeholder.png)

## Features
- **Heuristic Delivery Scoring**: Deterministic 0-100 scoring based on raw network telemetry.
- **Agnostic Architecture**: The AI parsing engine operates completely independently of the Next.js API boundaries allowing instant CLI tooling integration via `@inboxshield/engine`.
- **Advanced Diagnostics**:
  - Validates active DNS/MX resolutions.
  - Dynamically detects deprecated Null-MX configurations via `RFC 7505`.
  - Performs direct SMTP TLS handshakes on Port 25 validating live ciphers & protocol robustness.
  - Recursively guesses DKIM tags and validates RSA Base64 key encryption thickness (2048-bit minimum limits).
  - Validates DMARC deployment strings preventing phishing/spoofing exposure.
  - Scans High-Confidence Blocklists concurrently.
- **AI Analytics**: Generates real-time plain-english resolution paths natively based on diagnostic failure codes without expensive LLM bindings.
- **History Rollups**: Immutably caches full analysis models within PostgreSQL utilizing `jsonb`, making re-exports perfectly reproducible.

## Installation

### Prerequisites
- Node.JS >= 20.0.0
- NPM >= 10.0.0
- A local PostgreSQL database initialized

### Local Setup
1. Clone the repository and install internal npm workspaces natively:
   ```bash
   npm install --workspaces
   ```

2. Duplicate environmental variables:
   ```bash
   cp .env.example .env
   ```
   *Update `DATABASE_URL` accurately linking into a local postgres server.*

3. Execute migrations & generate local types:
   ```bash
   cd packages/db
   npx prisma generate
   ```

4. Bring the environment online:
   ```bash
   npm run dev --workspace=web
   ```

## Configuration

### Environment Variables
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL direct connection. |
| `NEXTAUTH_SECRET` | 32-byte UUID mapping internal session hashing logic. |

## Architecture V1
* **Control Plane (`apps/web`)**: Next.js 15 App router handling purely data-table serialization, history fetching, React-PDF bindings, and human authorization.
* **Engine (`packages/engine`)**: Agnostic Node TypeScript executable polling network sockets. Zero knowledge of UI or PostgreSQL.

## Roadmap (Iterative V2 Focus)
- **SaaS Conversion**: Migrating single configurations into multi-tenancy Workspace bindings.
- **O‍mniRoute Pipelining**: Launching Fastify/BullMQ nodes replacing theoretical heuristic models via real-time external POST integrations dispatching straight logic to Amazon SES/Postmark.
