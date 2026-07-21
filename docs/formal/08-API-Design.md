# 08. API Design

The primary product of InboxShield AI is the Data Plane routing API.

## Global Standards
- **Endpoint Base:** `https://api.inboxshield.ai/v1`
- **Data Format:** JSON exclusively.
- **Authentication:** Standard Bearer Tokens. `Authorization: Bearer <tenant_secret>`
- **Errors:** Standardized to RFC 7807 (Problem Details).

## Core Endpoints

### Dispatch: Send Email
`POST /emails/send`

**Request:**
```json
{
  "to": "client@example.com",
  "from": "sales@mycompany.com",
  "subject": "Follow up",
  "html": "<p>Hello</p>",
  "omni_route": true,
  "fallback_chain": ["SES", "SENDGRID"]
}
```

**Response (202 Accepted):**
```json
{
  "id": "msg_cuid1234",
  "status": "in_queue",
  "route_selected": "aws_ses_acc_1"
}
```

### Management: Domains
`GET /domains` (List domains)  
`POST /domains` (Register a new sending domain)  
`GET /domains/{domain_id}/health` (Get instantaneous RBL/DNS scoring check result)

### Management: ESP Configurations
`POST /esps` (Securely bind an AWS/SendGrid API key to the workspace)  
`PATCH /esps/{esp_id}` (Adjust baseline weighting or toggle active state)

## Rate Limiting Headers
Injected into every response by the Fastify Gateway via Redis Token Bucket algos:
- `X-RateLimit-Limit`: Maximum requests per window (e.g. 100).
- `X-RateLimit-Remaining`: Requests left in current window.
- `X-RateLimit-Reset`: UNIX timestamp when the window resets.
