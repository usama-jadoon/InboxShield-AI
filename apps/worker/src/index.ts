import Fastify from 'fastify';
import { webhookQueue, connection } from './queue/bullmq.config';
import { RedisRateLimiter } from './lib/rate-limit';
import { checkHealth, isHealthy } from './lib/health';
import { logger } from './lib/logger';
import './queue/webhook.worker';   // Initializes the webhook ingestion worker
import './queue/scan.worker';      // Initializes the canonical engine scan worker (V1-07)
import './queue/scheduled.scan.worker'; // Initializes the scheduled scans worker (V1-09)

const server = Fastify({ logger: true });

/**
 * Production rate limiter (V1-06) — Redis-backed fixed-window counter sharing
 * the BullMQ connection. Keyed per ESP so one misbehaving sender cannot flood
 * ingestion. Limits are env-tunable; defaults match the shared RateLimiter
 * contract (10 requests / 60s window).
 */
const webhookLimiter = new RedisRateLimiter(connection, {
  limit: Number(process.env.WEBHOOK_RATE_LIMIT_LIMIT ?? 10),
  windowSeconds: Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_SECONDS ?? 60),
  keyPrefix: 'inboxshield:webhook-ratelimit',
});

server.get('/health', async (_request, reply) => {
  // V1-12: verify DB + Redis connectivity before reporting healthy.
  const checks = await checkHealth();
  const healthy = isHealthy(checks);
  const statusCode = healthy ? 200 : 503;

  return reply.status(statusCode).send({
    status: healthy ? 'ok' : 'degraded',
    db: checks.db,
    redis: checks.redis,
    timestamp: new Date().toISOString(),
  });
});

server.post('/v1/webhooks/:esp', async (request, reply) => {
  const { esp } = request.params as { esp: string };

  // Rate limit per ESP before any work is enqueued (fail-open on Redis errors).
  const limit = await webhookLimiter.check(esp);
  if (!limit.allowed) {
    return reply
      .status(429)
      .header('Retry-After', String(limit.retryAfterSeconds ?? 60))
      .send({ error: 'Rate limit exceeded — try again later' });
  }

  // High-performance asynchronous push to Redis queue
  await webhookQueue.add('process-webhook', {
    esp,
    rawPayload: request.body
  });

  // Return immediately to the ESP hitting this webhook to avoid latency penalties
  return reply.status(200).send({ received: true });
});

const start = async () => {
  try {
    await server.listen({ port: 3001, host: '0.0.0.0' });
    logger.info({ port: 3001 }, 'InboxShield Data Plane Gateway running');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
