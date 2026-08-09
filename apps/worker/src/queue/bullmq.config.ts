import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

/**
 * Shared Redis connection for BullMQ and the RedisRateLimiter (V1-06).
 * `maxRetriesPerRequest: null` is required by BullMQ; it also prevents the
 * limiter's INCR/EXPIRE/TTL commands from being retried into a broken pipe.
 */
export const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const webhookQueueName = 'webhook-ingestion';

// Initialization of the Queue to push events onto from Fastify
export const webhookQueue = new Queue(webhookQueueName, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: true, 
    removeOnFail: 1000, // Keep 1000 failed jobs for introspection/DLQ
  },
});

export const queueEvents = new QueueEvents(webhookQueueName, { connection });
