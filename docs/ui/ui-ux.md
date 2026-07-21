# UI/UX & Dashboard Design

**Product Name:** InboxShield AI  

## 1. Design Language & Framework
- **Framework:** Next.js 15 App Router.
- **Styling:** Tailwind CSS v4.
- **Component Library:** `shadcn/ui` (Radix Primitives). Ensures accessible, zero-runtime, heavily customizable components.
- **Theme:** Default Dark Mode with optional Light mode toggle. Interface heavily inspired by Vercel/Stripe dashboards—minimal, high-contrast, data-dense.

## 2. Core Layout
- **Sidebar (Left):** Navigation (Overview, Domains, Routing, Logs, Settings).
- **Top Bar:** Tenant Switcher, Omnibar (Global Search), User Profile.
- **Main Content Area:** Max-width constrained for readability on ultrawide monitors, responsive grids for mobile tracking.

## 3. Key Views

### 3.1. Overview (The Control Center)
- **Top Metrics:** Health Score (0-100), Total Sent (24h), Bounce Rate (%), Complaint Rate (%).
- **Primary Chart:** Line chart comparing Deliveries vs. Bounces over time.
- **Alerts Panel:** Critical scanner warnings (e.g., "Domain mail.inboxshield.ai is missing a valid DMARC record").

### 3.2. Domain Scanner View
- A detailed layout showing the exact breakdown of SPF, DKIM, and DMARC.
- Uses strict color coding: Green (Pass), Yellow (Warning/SoftFail), Red (Strict Fail).
- **AI Recommendation Box:** Whenever a red/yellow metric is detected, the AI Layer generates a human-readable explanation and the exact TXT record required to fix it in Route53/Cloudflare.

### 3.3. Log Explorer
- A data-heavy table view of `EmailMessage` and `EmailEvent` records.
- **Filters:** By status (Bounced, Delivered), by Recipient ISP, by ESP used.
- Infinite scroll/pagination for traversing millions of events.

## 4. Accessibility (a11y)
- Strict adherence to WCAG 2.1 AA standards.
- All functional SVG icons must include `<title>` or `aria-label`.
- Full keyboard navigation support (achieved natively via Radix primitives in shadcn/ui).