# 14. Task Breakdown

## Immediate Implementation Pipeline (Next Steps)

### Task Cluster 1: Feature Specifications & Fastify Base
1. [ ] Finalize `omni.route.ts` heuristic scoring logic (converting mock into actual algorithm).
2. [ ] Map out specific route handlers: `POST /webhooks/ses` and `POST /webhooks/sendgrid`.
3. [ ] Implement S3/Object storage stub logic for managing large payload attachments safely.

### Task Cluster 2: Database and Queue
1. [ ] Write the Job Processor (`worker.queue.ts`) logic to convert proprietary ESP JSON into universal Prisma `EmailEvent` inserts via transaction batches (`createMany`).
2. [ ] Inject Prisma Client Extension for AES-256-GCM encryption of `EspAccount.credentials`.

### Task Cluster 3: Control Plane Initialization
1. [ ] Scaffold primary dashboard layout using standard Tailwind + shadcn/ui components in Next.js.
2. [ ] Build the UI Form for inserting and encrypting a new ESP Account key.
3. [ ] Hook NextAuth UI to standard credential checking logic.

### Task Cluster 4: Real-time OmniRoute Execution
1. [ ] Generate the `POST /v1/send` Fastify dispatch API.
2. [ ] Wire the `O‍mniRoute` logic to read the local Postgres/Redis health score and execute the actual outgoing HTTP fetch sequence.
