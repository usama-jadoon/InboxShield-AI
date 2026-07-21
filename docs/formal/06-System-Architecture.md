# 06. System Architecture (V1 Deliverability Analysis Platform)

**Status:** Approved (V1 Pivot)

## High-Level Topology
For V1, InboxShield AI is a dedicated Deliverability Analysis Platform focused purely on infrastructure health, scanning, and intelligence. 

To ensure maximum forward-compatability with V2 (SaaS/Routing), the system utilizes a modular Monorepo approach where the core scanning intelligence is entirely decoupled from the UI layer.

### 1. Control Plane (Next.js Edge)
- **Tech Stack:** Next.js 15, React 19, Vercel Serverless.
- **Role:** Handles human interactions, Dashboard, Domain additions, Report generation, and PDF exports.
- **Database Access:** Direct to Postgres via Prisma.

### 2. The Engine (Analyzer Module)
- **Tech Stack:** Node.js, TypeScript Library (`@inboxshield/engine`).
- **Role:** Pure execution of analysis. It takes a domain target and executes concurrent network requests for DNS, SMTP, TLS, and Blacklists.
- **Future-proofing:** Built as a standalone agnostic package. In V1, it is invoked directly by Next.js Server Actions. In V2, it can be wrapped in a Fastify/BullMQ worker without changing a single line of business logic.

### 3. Artificial Intelligence Layer
- **Tech Stack:** OpenAI / Anthropic SDK.
- **Role:** Takes the raw structured output of the Analyzer Engine, converts the diagnostic codes into business-level explanations, and proposes exact DNS/Configuration remediation steps.

## Data Flow Diagram
```text
[User] --> (Add Domain / Trigger Scan) -> [Next.js Server Action]
                                                |
                                      [Analyzer Engine]
                                      /  |  |  |  \
                                   DNS SPF MX TLS RBLs
                                      \  |  |  |  /
                                     [Aggregated Results]
                                                |
                                       [Scoring Engine]
                                                |
                                          [AI Layer] --------- [OpenAI/Anthropic]
                                                |
                                     (Save to Postgres DB)
                                                |
                                        [PDF / UI Report]
```
