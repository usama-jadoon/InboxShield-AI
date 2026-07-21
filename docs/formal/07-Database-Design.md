# 07. Database Design (V1 Deliverability Intelligence)

**Engine:** PostgreSQL  
**ORM:** Prisma  

## Schema Entities

### Workspace
User grouping (Future-proofed for V2 multi-tenancy).
- `id` (cuid)
- `name` (String)

### Domain
Target domains being monitored.
- `id` (cuid)
- `domainName` (String, Unique)
- `workspaceId` (FK)

### ScanReport
Snapshot history of a domain's health at a specific time.
- `id` (cuid)
- `domainId` (FK)
- `score` (Int: 0-100)
- `riskLevel` (String)
- `results` (JSONB) - Snapshot of the exact technical DNS/SMTP returns.
- `aiAnalysis` (JSONB) - The LLM's plain-english remediation steps.
- `createdAt` (DateTime) - For charting historical uptime/health.
