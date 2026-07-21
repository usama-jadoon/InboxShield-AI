# 11. Testing Protocol

## The Testing Pyramid

### 1. Unit Testing
- **Framework:** `Vitest` (Fast, native ESM).
- **Target:** Core algorithms (`O‍mniRoute` logic, payload normalization functions, DNS parsing heuristics).
- **Hard Rule:** Zero network calls allowed. Redis, Postgres, and external HTTP calls MUST be mocked.

### 2. Integration Testing
- **Framework:** `Vitest` + `Testcontainers`
- **Target:** API route handlers, Webhook Ingress (Fastify), and Prisma DB queries.
- **Workflow:** The CI pipeline spins up a throwaway Postgres Docker container, runs prisma migrations, hits the actual API endpoints with supertest, verifies data writes correctly, and destroys the container.

### 3. End-to-End (E2E) Testing
- **Framework:** `Playwright`
- **Target:** Next.js Dashboard.
- **Workflow:** Simulate human login scenarios, asserting that the Tenant switcher works, Domain Health reports render, and the ESP API key submission form successfully encrypts data.

### 4. Load & Performance Testing (Crucial)
- **Framework:** `k6`
- **Target:** Worker Node.js Webhook processing.
- **Test Case:** Simulating a generic "Spam Blast Response"—bombarding the local Fastify webhook receiver with 5,000 asynchronous bounce JSON payloads in 10 seconds.
- **Criteria:** Application must not exceed CPU constraints or drop payloads. BullMQ must stabilize queue depth smoothly.
