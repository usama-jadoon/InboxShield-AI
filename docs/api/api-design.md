# API Design Document

**Product Name:** InboxShield AI  
**Document Status:** Approved Draft  

---

## 1. API Architecture Paradigm
The Control Plane (Next.js) will utilize **Server Actions** and **React Server Components (RSC)** for internal dashboard data fetching to bypass standard REST/GraphQL overhead. 

However, the Data Plane (Fastify Worker) and any external SaaS endpoints must expose a strict, versioned **REST API** using JSON over HTTPS, adhering to OpenAPI 3.1 specifications.

---

## 2. Global Standards
- **Base URL:** `https://api.inboxshield.ai/v1`
- **Content-Type:** `application/json`
- **Authentication:** `Authorization: Bearer <sk_live_...>`
- **Rate Limiting Headers:** 
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`
- **Pagination:** Cursor-based pagination (`?cursor=xyz&limit=50`) for high-performance timeline queries.

---

## 3. Core Endpoints (Data Plane - Outbound)

### 3.1. Dispatch Email
The synchronous HTTP endpoint for sending an email via OmniRoute.

**POST** `/v1/emails/send`

**Request Body:**
```json
{
  "to": ["user@example.com"],
  "cc": [],
  "bcc": [],
  "from": "marketing@inboxshield.ai",
  "subject": "Unlock Deliverability",
  "html": "<html>...</html>",
  "text": "Fallback text...",
  "omni_route": true, 
  "tags": ["campaign_id_123"]
}
```

**Response (202 Accepted):**
*Note: We return 202 because the final ESP delivery is asynchronous via the webhook pipeline.*
```json
{
  "id": "msg_cuid123456",
  "status": "queued",
  "estimated_latency_ms": 42
}
```

---

## 4. Core Endpoints (Control Plane - Mgmt)

### 4.1. Domain Management
**POST** `/v1/domains` (Register a new domain)
**GET** `/v1/domains` (List workspaces domains)
**GET** `/v1/domains/{domain_id}/health` (Get real-time scanner metrics)

### 4.2. ESP Configuration
**POST** `/v1/esps` (Add SendGrid/SES keys)
**PATCH** `/v1/esps/{esp_id}` (Update weights or pause)

### 4.3. Analytics
**GET** `/v1/analytics/timeline?start=timestamp&end=timestamp`
Returns aggregated time-series data of bounces, deliveries, and complaints.

---

## 5. Webhook Ingestion (Inbound)

These endpoints are exposed publicly but protected via HMAC signatures or ESP-specific auth logic.

- **POST** `/webhooks/aws-ses`
- **POST** `/webhooks/sendgrid`
- **POST** `/webhooks/mailgun`

*The ingress worker immediately returns 200 OK after validating the payload signature, placing the heavy lifting onto the BullMQ queue.*

---

## 6. Error Handling
All errors follow standard RFC 7807 Problem Details for HTTP APIs.

**Example 400 Bad Request:**
```json
{
  "error": {
    "code": "invalid_request",
    "message": "The 'to' array must contain at least one valid email address.",
    "documentation_url": "https://docs.inboxshield.ai/api/errors#invalid_request"
  }
}
```