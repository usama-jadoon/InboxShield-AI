import { Queue, QueueEvents, RepeatOptions } from 'bullmq';
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
export const scanQueueName = 'scan-execution';
export const scheduledScanQueueName = 'scheduled-scans';

/**
 * Default repeat options for scheduled scans.
 * Runs daily at 02:00 UTC by default; configurable via env.
 */
export const scheduledScanRepeatOptions: RepeatOptions = {
  pattern: process.env.SCHEDULED_SCAN_CRON || '0 2 * * *', // Daily at 02:00 UTC
  tz: 'UTC',
  // Ensure we don't create duplicate repeatable jobs on worker restart
  endDate: undefined,
  limit: undefined,
};

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

export const scanQueue = new Queue(scanQueueName, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

/**
 * Scheduled scans queue — uses repeatable jobs for recurring domain scans.
 * Each repeatable job represents a domain that should be scanned on a schedule.
 */
export const scheduledScanQueue = new Queue(scheduledScanQueueName, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 100,
  },
});

export const queueEvents = new QueueEvents(webhookQueueName, { connection });
export const scheduledScanQueueEvents = new QueueEvents(scheduledScanQueueName, { connection });

/**
 * Register a domain for recurring scans.
 * Creates a repeatable job that will fire on the configured schedule.
 *
 * @param domain - The domain to scan
 * @param workspaceId - The workspace the domain belongs to
 * @param options - Optional repeat options (defaults to daily at 02:00 UTC)
 */
export async function registerScheduledScan(
  domain: string,
  workspaceId: string,
  options?: RepeatOptions
): Promise<string> {
  const repeatOpts = options || scheduledScanRepeatOptions;

  const jobId = `scheduled-scan:${workspaceId}:${domain}`;

  await scheduledScanQueue.add(
    'execute-scheduled-scan',
    { domain, workspaceId },
    {
      jobId,
      repeat: repeatOpts,
      // Ensure idempotency: if jobId exists, update its repeat pattern
      removeOnComplete: true,
      removeOnFail: 100,
    }
  );

  return jobId;
}

/**
 * Remove a scheduled scan for a domain.
 */
export async function removeScheduledScan(
  domain: string,
  workspaceId: string
): Promise<void> {
  const logicalJobId = `scheduled-scan:${workspaceId}:${domain}`;

  // Find the repeatable job by matching the logical jobId in opts.repeat.jobId
  const repeatable = await scheduledScanQueue.getRepeatableJobs();
  for (const r of repeatable) {
    if (!r.key || r.name !== 'execute-scheduled-scan') continue;
    const generatedJobKey = `repeat:${r.key}:${r.next}`;
    const job = await scheduledScanQueue.getJob(generatedJobKey);
    if (job?.opts?.repeat?.jobId === logicalJobId) {
      await scheduledScanQueue.removeRepeatableByKey(r.key);
      return;
    }
  }
  // Fallback: try removing by logical jobId (works if BullMQ maps it)
  await scheduledScanQueue.removeRepeatableByKey(logicalJobId);
}

/**
 * Get all registered scheduled scans.
 */
export async function getScheduledScans(): Promise<Array<{
  jobId: string;
  domain: string;
  workspaceId: string;
  nextRun: Date | null;
}>> {
  const repeatable = await scheduledScanQueue.getRepeatableJobs();

  const results = [];
  for (const r of repeatable) {
    if (!r.key || r.name !== 'execute-scheduled-scan') continue;

    // BullMQ's getRepeatableJobs returns only metadata (key, pattern, next run).
    // The logical jobId we provided (scheduled-scan:${workspaceId}:${domain})
    // is stored in opts.repeat.jobId of the generated repeat job.
    // We must fetch that job to extract it.
    const generatedJobKey = `repeat:${r.key}:${r.next}`;
    const job = await scheduledScanQueue.getJob(generatedJobKey);
    const logicalJobId = job?.opts?.repeat?.jobId || r.key;

    const parts = logicalJobId.split(':');
    results.push({
      jobId: logicalJobId,
      domain: parts[2] || '',
      workspaceId: parts[1] || '',
      nextRun: r.next ? new Date(r.next) : null,
    });
  }

  return results;
}