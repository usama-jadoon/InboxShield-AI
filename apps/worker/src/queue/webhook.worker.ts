import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { webhookQueueName } from './bullmq.config';

// Ensure the connection uses maxRetriesPerRequest: null, which is required by BullMQ
const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

export const webhookWorker = new Worker(
  webhookQueueName,
  async (job: Job) => {
    // Expected Payload: { esp: 'ses' | 'sendgrid', rawPayload: object }
    // Processing Logic:
    // 1. Determine ESP
    // 2. Normalize JSON to standard 'EmailEvent' DTO
    // 3. Increment Redis reputation matrices based on bounce/complaint/delivery signal
    // 4. Batch push to Prisma PostgreSQL via createMany
    
    console.log(`Processing Webhook Job ${job.id} for ESP: ${job.data.esp}`);
    
    // Simulate DB operation
    await new Promise((resolve) => setTimeout(resolve, 50));
    
    return { status: 'processed' };
  },
  {
    connection,
    concurrency: 50, // Process 50 webhooks synchronously off the event loop
  }
);

webhookWorker.on('completed', (job) => {
  // console.log(`Job ${job.id} completed!`);
});

webhookWorker.on('failed', (job, err) => {
  console.error(`Job ${job?.id} failed with error ${err.message}`);
});
