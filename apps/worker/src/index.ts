import Fastify from 'fastify';
import { webhookQueue, connection } from './queue/bullmq.config';
import { RedisRateLimiter } from './lib/rate-limit';
import './queue/webhook.worker'; // Initializes the polling worker instance
import './queue/scan.worker';   // Initializes the canonical engine scan worker (V1-07)

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

server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
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
    console.log('InboxShield Data Plane Gateway running on port 3001');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
