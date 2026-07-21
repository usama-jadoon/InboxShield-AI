# 04. User Stories

**Related Documents:** 
- [03. Product Requirements](./03-Product-Requirements-Document.md)
- [09. UI/UX](./09-UI-UX.md)

## Epic 1: Dynamic OmniRoute Dispatch
- **US1.1:** As a Developer, I want to send an email payload to a single InboxShield API so that I don't have to write custom integration code for multiple ESPs individually.
- **US1.2:** As an Ops Manager, I want the system to automatically fallback to an alternative ESP when my primary ESP starts returning HTTP 5xx or `429 Too Many Requests`, so my campaigns aren't delayed.
- **US1.3:** As a Deliverability Engineer, I want OmniRoute heuristic AI to route exclusively to IPs with the highest historical success rate for Google Workspace targets when sending to a `@gmail.com` address.

## Epic 2: Platform Telemetry & Reporting
- **US2.1:** As a Growth Marketer, I want a unified dashboard showing bounce, delivery, open, and *reply* rates across all my domains over the last 30 days so that I can gauge campaign health.
- **US2.2:** As an Admin, I want to view the raw webhook logs for a specific recipient, so I can debug exactly why an email hard-bounced at the provider level.

## Epic 3: Scanners & Infrastructure Health
- **US3.1:** As an Ops Manager, I want to see a visual checklist of my domain's SPF, DKIM, and DMARC status, so I know I'm compliant with the stringent 2024+ sender guidelines.
- **US3.2:** As a System, I want to automatically ping Spamhaus and Barracuda blacklists every 6 hours, so that I can immediately deprecate an IP's routing score if it gets listed.

## Epic 4: AI Insights
- **US4.1:** As a Marketer, I want to run my email draft through the AI UI to get a Spam Risk assessment, so that I can rewrite problematic phrasing before dropping the list.
- **US4.2:** As an Ops Manager looking at a failed DMARC record, I want the AI to show me the exact TXT record I need to copy and paste into Cloudflare to fix the issue.

## Epic 5: Tenant & Security
- **US5.1:** As a SaaS Client (Admin), I want to invite my team members with "Viewer" access so they can view dashboards without accidentally altering my ESP configurations.
- **US5.2:** As a Developer, I want to generate an API key securely scoped to my Tenant, so my external application can authenticate against the dispatch gateway.
