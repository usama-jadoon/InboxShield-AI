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
