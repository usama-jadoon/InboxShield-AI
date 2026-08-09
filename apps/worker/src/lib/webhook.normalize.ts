/**
 * Webhook normalization utilities (V1-08).
 *
 * Converts raw ESP webhook payloads into a unified NormalizedWebhookEvent
 * DTO that the worker persists as EmailEvent rows.
 */

import type { NormalizedWebhookEvent } from '@inboxshield/types';

interface SesBounce {
  bounceType: string;
  bounceSubType: string;
  bouncedRecipients: Array<{ emailAddress: string }>;
  feedbackId?: string;
}

interface SesComplaint {
  complainedRecipients: Array<{ emailAddress: string }>;
  feedbackId?: string;
}

interface SesDelivery {
  recipients: string[];
  smtpResponse: string;
  processingTimeMillis: number;
}

interface SesEvent {
  eventType: 'Delivery' | 'Bounce' | 'Complaint' | 'Open';
  mail: {
    messageId: string;
    destination: string[];
    timestamp: string;
  };
  bounce?: SesBounce;
  complaint?: SesComplaint;
  delivery?: SesDelivery;
  open?: { timestamp: string };
}

interface SendGridEvent {
  event: 'delivered' | 'bounce' | 'spam_report' | 'open' | 'click' | 'deferred' | 'processed' | 'dropped';
  sg_message_id: string;
  email: string;
  timestamp: number;
  reason?: string;
  response?: string;
  smtp_id?: string;
}

/**
 * Normalize SES webhook payload (SNS-wrapped or direct).
 */
export function normalizeSes(payload: any): NormalizedWebhookEvent[] {
  // Handle SNS envelope
  let records: any[] = [];
  if (payload.Records) {
    records = payload.Records.map((r: any) => {
      try { return JSON.parse(r.Sns?.Message ?? '{}'); } catch { return {}; }
    });
  } else if (payload.eventType) {
    records = [payload];
  } else {
    records = [];
  }

  return records
    .filter(r => r && r.eventType)
    .map((r: SesEvent) => {
      const base = {
        provider: 'SES' as const,
        message_id: r.mail?.messageId ?? '',
        timestamp: new Date(r.mail?.timestamp ?? Date.now()),
      };

      switch (r.eventType) {
        case 'Bounce': {
          return {
            ...base,
            event_type: 'BOUNCE' as const,
            diagnostics: `type=${r.bounce?.bounceType}; subType=${r.bounce?.bounceSubType}`,
          };
        }
        case 'Complaint': {
          return {
            ...base,
            event_type: 'COMPLAINT' as const,
            diagnostics: `feedbackId=${r.complaint?.feedbackId}`,
          };
        }
        case 'Delivery': {
          return {
            ...base,
            event_type: 'DELIVERY' as const,
            diagnostics: `smtpResponse=${r.delivery?.smtpResponse}; processingTimeMs=${r.delivery?.processingTimeMillis}`,
          };
        }
        case 'Open': {
          return {
            ...base,
            event_type: 'OPEN' as const,
            diagnostics: 'open event',
          };
        }
        default:
          return {
            ...base,
            event_type: 'DELIVERY' as const,
            diagnostics: `unknown SES event ${r.eventType}`,
          };
      }
    });
}

/**
 * Normalize SendGrid webhook payload (array of events).
 */
export function normalizeSendGrid(payload: any[]): NormalizedWebhookEvent[] {
  const events = Array.isArray(payload) ? payload : [payload];
  return events
    .filter(e => e && e.event)
    .map((e: SendGridEvent) => {
      const mapType = (evt: string): NormalizedWebhookEvent['event_type'] => {
        switch (evt) {
          case 'delivered': return 'DELIVERY';
          case 'bounce': case 'deferred': case 'dropped': return 'BOUNCE';
          case 'spam_report': return 'COMPLAINT';
          case 'open': return 'OPEN';
          default: return 'DELIVERY';
        }
      };
      return {
        message_id: e.sg_message_id ?? '',
        provider: 'SENDGRID',
        event_type: mapType(e.event),
        timestamp: new Date(e.timestamp * 1000),
        diagnostics: e.reason ? `reason=${e.reason}` : e.response ? `response=${e.response}` : undefined,
      };
    });
}

/**
 * Normalize Mailgun webhook payload (single event object).
 */
export function normalizeMailgun(payload: any): NormalizedWebhookEvent[] {
  if (!payload || !payload.event) return [];
  const mapType = (evt: string): NormalizedWebhookEvent['event_type'] => {
    switch (evt) {
      case 'delivered': return 'DELIVERY';
      case 'bounced': case 'failed': return 'BOUNCE';
      case 'complained': return 'COMPLAINT';
      case 'opened': return 'OPEN';
      default: return 'DELIVERY';
    }
  };
  return [{
    message_id: payload.message?.headers?.['message-id'] ?? '',
    provider: 'MAILGUN',
    event_type: mapType(payload.event),
    timestamp: new Date(payload.timestamp * 1000),
    diagnostics: payload.reason ? `reason=${payload.reason}` : undefined,
  }];
}

/**
 * Dispatch to the correct normalizer based on ESP identifier.
 */
export function normalizeWebhook(esp: string, payload: any): NormalizedWebhookEvent[] {
  switch (esp.toLowerCase()) {
    case 'ses': return normalizeSes(payload);
    case 'sendgrid': return normalizeSendGrid(payload);
    case 'mailgun': return normalizeMailgun(payload);
    default: throw new Error(`Unsupported ESP: ${esp}`);
  }
}