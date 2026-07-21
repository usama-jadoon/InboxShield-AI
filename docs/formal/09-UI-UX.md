# 09. UI/UX Specifications

## Framework & Tooling
- **Framework:** Next.js 15 App Router (`app/`).
- **Styling:** Tailwind CSS.
- **Component Library:** `shadcn/ui` based on Radix primitives.
- **Animation:** `framer-motion` (used sparingly for dashboard transitions).

## Core Layout Structure
A traditional, data-heavy B2B SaaS layout.
- **Sidebar (Left, Fixed):** Persistent navigation containing global workspace links (Overview, Sending Domains, Routing Rules, Event Logs, API Keys, Settings).
- **Top Navbar:** Contains breadcrumbs, global omni-search (`Cmd+K` palette), and Workspace Context Switcher (dropdown to switch between tenant environments).
- **Main Content (Fluid):** Max-width constrained to `max-w-7xl` to prevent layout breaking on ultra-wide monitors.

## Design Philosophy
The system must look like an enterprise security product, not a consumer app.
- **Theme:** Forced Dark Mode default. High contrast borders (`border-neutral-800`), deep backgrounds (`bg-black` or `bg-neutral-950`).
- **Typography:** `Inter` or standard sans-serif system fonts. Monospace (`Geist Mono` or `JetBrains`) strictly used for rendering API logs, keys, and DMARC TXT records.

## Essential Views
1. **The Executive Overview:** 4 primary top-line metrics (Deliverability %, Bounce Rate, Total Volume, AI Threat Blocks). A central time-series area chart.
2. **Domain Health Analyzer:** A traffic light system (Red/Yellow/Green) for SPF, DKIM, DMARC, and RBLs.
3. **Log Explorer:** A data table with extremely fast filtering capabilities. Must implement infinite scroll or pagination to traverse millions of logs without freezing the browser.
