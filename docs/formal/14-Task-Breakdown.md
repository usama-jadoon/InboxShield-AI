# 14. Task Breakdown

## Immediate Implementation Pipeline

### Task Cluster 1: Data Modeling
1. [ ] Finalize `schema.prisma` mapping out `Tenant`, `Domain`, `EspAccount`, `EmailMessage`, `EmailEvent`.
2. [ ] Inject Prisma middleware for `aes-256-gcm` encryption of the `EspAccount.credentials` JSON field.
3. [ ] Run initial local db migrations.

### Task Cluster 2: The Data Plane (Worker Application)
1. [ ] Build Fastify standard HTTP server in `apps/worker`.
2. [ ] Map out `POST /webhooks/ses` and `POST /webhooks/sendgrid`.
3. [ ] Initialize BullMQ `Queue` and `Worker` instances attached to local Redis.
4. [ ] Write the Job Processor logic to convert proprietary ESP JSON into Prisma `EmailEvent` inserts.

### Task Cluster 3: The Control Plane (Web Application)
1. [ ] Configure NextAuth.js (Auth.js) credentials/session provider.
2. [ ] Scaffold primary dashboard layout using standard Tailwind + shadcn/ui components.
3. [ ] Build the Form action for inserting/encrypting a new ESP Account key.

### Task Cluster 4: Real-time OmniRoute Execution
1. [ ] Generate the `POST /v1/send` dispatch API.
2. [ ] Implement the `O‍mniRoute` heuristic function to read the local Postgres/Redis health score and select the best ESP ID.
3. [ ] Execute outgoing HTTP payload generation to external ESP APIs.
