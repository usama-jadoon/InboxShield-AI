export interface EmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  from: string;
  subject: string;
  html: string;
  text?: string;
  omni_route?: boolean;
}

export interface NormalizedWebhookEvent {
  message_id: string;
  provider: 'SES' | 'SENDGRID' | 'MAILGUN';
  event_type: 'DELIVERY' | 'BOUNCE' | 'COMPLAINT' | 'OPEN';
  timestamp: Date;
  diagnostics?: string;
}

/**
 * Shared rate-limiting contract (V1-06).
 *
 * Both the web app (`apps/web/src/lib/rate-limit.ts`) and the worker
 * (`apps/worker/src/lib/rate-limit.ts`) implement this same interface so a
 * Redis-backed limiter can be swapped in behind it without changing callers.
 */
export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
  remaining?: number;
}

export interface RateLimiter {
  check(key: string): Promise<RateLimitResult>;
}