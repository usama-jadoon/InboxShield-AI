import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@inboxshield/db';
import { webhookQueueName, connection } from './bullmq.config';
import { normalizeWebhook } from '../lib/webhook.normalize';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();

/**
 * Real webhook ingestion worker (V1-08).
 *
 * Processes raw ESP webhook payloads, normalizes to EmailEvent DTOs,
 * and persists them to PostgreSQL via Prisma. Uses batched createMany
 * for throughput.
 */
export const webhookWorker = new Worker(
  webhookQueueName,
  async (job: Job) => {
    const { esp, rawPayload } = job.data as { esp: string; rawPayload: any };
    const log = logger.child({ correlationId: job.id, esp });

    log.info('processing webhook');

    // Normalize raw payload to unified DTO
    let normalized: ReturnType<typeof normalizeWebhook>;
    try {
      normalized = normalizeWebhook(esp, rawPayload);
    } catch (err) {
      log.error({ error: err instanceof Error ? err.message : err }, 'webhook normalization failed');
      return { status: 'failed', reason: 'normalization_error' };
    }

    if (normalized.length === 0) {
      log.info('webhook produced 0 events, skipping');
      return { status: 'skipped', reason: 'no_events' };
    }

    // Map to EmailEvent create input
    const events = normalized.map(e => ({
      messageId: e.message_id,
      provider: e.provider,
      eventType: e.event_type,
      // Extract email from diagnostics or use placeholder; real impl would parse from raw
      email: extractEmail(e.diagnostics ?? '', rawPayload) ?? 'unknown@example.com',
      domainId: null, // TODO: link to Domain if workspace-scoped
      timestamp: e.timestamp,
      diagnostics: e.diagnostics,
    }));

    // Bulk insert with skip-duplicate on messageId unique constraint
    const result = await prisma.emailEvent.createMany({
      data: events,
      skipDuplicates: true,
    });

    log.info({ inserted: result.count }, 'webhook inserted EmailEvent rows');

    return { status: 'processed', count: result.count };
  },
  {
    connection,
    concurrency: 50,
  }
);

function extractEmail(diagnostics: string, raw: any): string | null {
  // Best-effort extraction from common payload shapes
  if (raw?.mail?.destination?.[0]) return raw.mail.destination[0];
  if (raw?.email) return raw.email;
  if (raw?.recipient) return raw.recipient;
  if (raw?.Records?.[0]?.Sns?.Message) {
    try {
      const msg = JSON.parse(raw.Records[0].Sns.Message);
      if (msg?.mail?.destination?.[0]) return msg.mail.destination[0];
      if (msg?.bounce?.bouncedRecipients?.[0]?.emailAddress) return msg.bounce.bouncedRecipients[0].emailAddress;
      if (msg?.complaint?.complainedRecipients?.[0]?.emailAddress) return msg.complaint.complainedRecipients[0].emailAddress;
    } catch {
      // ignore parse errors, fall through to next extraction
    }
  }
  // Fallback: look for email-like string in diagnostics
  const m = diagnostics.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
}

webhookWorker.on('completed', (_job) => {
  // console.log(`Job ${job.id} completed!`);
});

webhookWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'webhook job failed');
});