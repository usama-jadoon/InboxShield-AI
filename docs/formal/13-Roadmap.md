# 13. Roadmap (V1 Deliverability Intelligence)

## Phase 1: Core Analysis Engine
- Implement standalone Node.js scanner libraries (DNS, SPF, DKIM, DMARC, MX, SMTP, TLS, WHOIS).
- Implement top-tier Real-Time Blackhole List (RBL) concurrency scanning.
- Output normalized structured diagnostics logs.

## Phase 2: Intelligence & Scoring
- Heuristic Deliverability Scoring (0-100 logic based on strict RFC standards).
- Risk Level assignments (Critical, High, Medium, Low).
- AI Integration for translating technical failures into plain-english mitigation steps.

## Phase 3: The Platform
- Next.js 15 UI / Dashboard.
- Postgres / Prisma integration for preserving Scan History.
- PDF Report generation using Puppeteer/React-pdf.
