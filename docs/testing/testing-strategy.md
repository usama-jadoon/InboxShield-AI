# Testing Strategy

**Product Name:** InboxShield AI

To achieve Google/Stripe level engineering confidence, the testing pipeline must be rigorous and fully automated.

## 1. Testing Pyramid

### 1.1 Unit Testing (Vitest)
- **Target:** Core utilities, OmniRoute algorithm, parsing logic (e.g. Scanners).
- **Rules:** No network or database calls. All external dependencies must be strictly mocked.
- **Current Coverage:** `dns.scanner`, `spf.scanner`, `dkim.scanner`, `dmarc.scanner`, `blacklist.scanner`, `scoring.engine`, `omni.route`.

### 1.2 Integration Tests (Vitest + Testcontainers)
- **Target:** Webhook Ingestion API and DB persistence.
- **Rules:** Run inside Docker with isolated PostgreSQL and Redis instances.

### 1.3 End-to-End Tests (Playwright)
- **Target:** Next.js Dashboard.
- **Status:** Basic smoke testing planned for layout, navigation, and MetricCard rendering.

## 2. CI/CD Requirements
- `main` branch protected.
- Minimum 80% coverage on data-plane services.

## 3. Security Validation
- All external dependencies scanned via `pnpm audit`.
- Outbound spam scoring verified via `omni.route` heuristic tests.
