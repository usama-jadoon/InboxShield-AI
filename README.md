<div align="center">
  <h1>🛡️ InboxShield AI</h1>
  <p>Automated domain authentication and reputation monitoring platform.</p>

  <!-- Badges -->
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-20.0+-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="TailwindCSS" /></a>
  <a href="https://turborepo.org/"><img src="https://img.shields.io/badge/Turborepo-2-EF4444?style=for-the-badge&logo=turborepo&logoColor=white" alt="Turborepo" /></a>
</div>

## 📌 Product Overview

InboxShield AI actively scans and analyzes domain DNS records (SPF, DKIM, DMARC, MX) and reputation signals. It generates actionable remediation reports and insights to ensure high email deliverability. Built as a unified monorepo utilizing **Turborepo**.

<!-- Project Screenshots Placeholder -->
## 📸 Gallery
> *(Add screenshots of your Dashboard, Scan Reports, and PDF exports here)*

---

## ✨ Features

- [x] **Scalable Worker Queue** (BullMQ, Redis) for resilient webhook ingestion and task processing.
- [x] **Intelligent Scanning Engine** evaluating critical configuration records (MX, SPF, DMARC, DNSSEC, etc.).
- [x] **Web Dashboard** natively built with Next.js App Router for analytics and reporting.
- [x] **Persistent Scan History** via Prisma ORM and PostgreSQL.
- [x] **Automated Release Readiness Reports** detailing deployment checks.

---

## 🏗️ Architecture Overview

The workspace follows a scalable monorepo standard managed by Turborepo:

*   **`apps/web`**: **Next.js 16** control plane dashboard (Front-end & Edge APIs).
*   **`apps/worker`**: **BullMQ** daemon processing webhooks and performing background DNS scanning off the main UI thread.
*   **`packages/engine`**: Core logic controlling the domain scanning orchestration.
*   **`packages/db`**: **Prisma** database definitions for global repository access.

### Tech Stack Breakdown
*   **Frontend**: Next.js (React), TailwindCSS v4, Shadcn UI
*   **Backend**: Node.js, Fastify, BullMQ
*   **Database/Cache**: PostgreSQL (Prisma), Redis (ioredis)
*   **Build System**: Turborepo, TypeScript

---

## 🚀 Local Development

### 1. Requirements
Ensure you are using **Node.js 20.0.0** or higher.

### 2. Environment Setup
Create a `.env` file in the root directory (this file is excluded via `.gitignore`). Include the following:
```env
# PostgreSQL connection string for Prisma
DATABASE_URL="postgresql://user:password@localhost:5432/inboxshield"

# Connection string for BullMQ inside `apps/worker`
REDIS_URL="redis://localhost:6379"
```

### 3. Installation
Clone the repository and install the mono-repo dependencies.
```bash
git clone https://github.com/usama-jadoon/InboxShield-AI.git
cd InboxShield-AI
npm install
```

### 4. Development Commands
All scripts are executable from the root of the project.

| Command | Description |
| :--- | :--- |
| `npm run dev` | Spins up all development servers (Web & Worker) using Turbo. |
| `npm run build` | Generates highly-optimized production builds. |
| `npm run lint` | Checks for linting errors across all packages. |
| `npm run test` | Executes the testing suite. |
| `turbo run typecheck`| Validates TS typings globally across the workspace. |

---

## 🛣️ Roadmap

- [ ] Integrate full production implementations for `DnssecScanner` and `WhoisScanner` utilizing dedicated APIs.
- [ ] Complete the universal export pipeline utilizing `ReportGenerator` to stream secure PDFs and CSVs.
- [ ] Expand full automated CI/CD deployment pipelines (Vercel/Docker).
