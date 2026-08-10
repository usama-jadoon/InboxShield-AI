import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis/IORedis and BullMQ
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
    })),
  };
});

// Mock the Queue and Worker classes
vi.mock('bullmq', async () => {
  const actual = await vi.importActual('bullmq');
  return {
    ...actual,
    Queue: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue({ id: 'test-job-1' }),
      removeRepeatableByKey: vi.fn().mockResolvedValue(true),
      getRepeatableJobs: vi.fn().mockResolvedValue([]),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    Worker: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
    QueueEvents: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

describe('Scheduled Scans Queue Configuration (V1-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // First import of ./bullmq.config triggers vi.importActual('bullmq') — the
  // real BullMQ package must be transformed on a cold process, which can exceed
  // vitest's default 5s timeout. 10s guards that cold-transform cost without
  // weakening the assertion.
  it('should export scheduledScanQueueName', async () => {
    const { scheduledScanQueueName } = await import('./bullmq.config');
    expect(scheduledScanQueueName).toBe('scheduled-scans');
  }, 10_000);

  it('should export scheduledScanRepeatOptions with default cron', async () => {
    const { scheduledScanRepeatOptions } = await import('./bullmq.config');
    expect(scheduledScanRepeatOptions).toEqual({
      pattern: '0 2 * * *', // Daily at 02:00 UTC
      tz: 'UTC',
      endDate: undefined,
      limit: undefined,
    });
  });

  it('should export scheduledScanQueue instance', async () => {
    const { scheduledScanQueue } = await import('./bullmq.config');
    expect(scheduledScanQueue).toBeDefined();
    expect(typeof scheduledScanQueue.add).toBe('function');
  });

  it('should export scheduledScanQueueEvents instance', async () => {
    const { scheduledScanQueueEvents } = await import('./bullmq.config');
    expect(scheduledScanQueueEvents).toBeDefined();
  });

  describe('registerScheduledScan', () => {
    it('should call queue.add with correct job data and repeat options', async () => {
      const { scheduledScanQueue, registerScheduledScan } = await import('./bullmq.config');

      const jobId = await registerScheduledScan('example.com', 'workspace-123');

      expect(jobId).toBe('scheduled-scan:workspace-123:example.com');
      expect(scheduledScanQueue.add).toHaveBeenCalledWith(
        'execute-scheduled-scan',
        { domain: 'example.com', workspaceId: 'workspace-123' },
        expect.objectContaining({
          jobId: 'scheduled-scan:workspace-123:example.com',
          repeat: expect.objectContaining({
            pattern: '0 2 * * *',
            tz: 'UTC',
          }),
        })
      );
    });

    it('should accept custom repeat options', async () => {
      const { scheduledScanQueue, registerScheduledScan } = await import('./bullmq.config');

      const customOptions = { pattern: '0 * * * *', tz: 'UTC' }; // Hourly
      await registerScheduledScan('example.com', 'workspace-123', customOptions);

      expect(scheduledScanQueue.add).toHaveBeenCalledWith(
        'execute-scheduled-scan',
        { domain: 'example.com', workspaceId: 'workspace-123' },
        expect.objectContaining({
          repeat: expect.objectContaining({
            pattern: '0 * * * *',
            tz: 'UTC',
          }),
        })
      );
    });
  });

  describe('removeScheduledScan', () => {
    it('should call queue.removeRepeatableByKey with correct jobId', async () => {
      const { scheduledScanQueue, removeScheduledScan } = await import('./bullmq.config');

      await removeScheduledScan('example.com', 'workspace-123');

      expect(scheduledScanQueue.removeRepeatableByKey).toHaveBeenCalledWith('scheduled-scan:workspace-123:example.com');
    });
  });

  describe('getScheduledScans', () => {
    it('should return formatted scheduled scans from repeatable jobs', async () => {
      const { scheduledScanQueue, getScheduledScans } = await import('./bullmq.config');

      const mockRepeatableJobs = [
        { key: 'scheduled-scan:workspace-123:example.com', next: Date.now() + 86400000 },
        { key: 'scheduled-scan:workspace-456:test.com', next: Date.now() + 43200000 },
        { key: 'other-job:some-key', next: Date.now() + 10000 }, // Should be filtered out
      ];

      (scheduledScanQueue.getRepeatableJobs as any).mockResolvedValue(mockRepeatableJobs);

      const result = await getScheduledScans();

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        jobId: 'scheduled-scan:workspace-123:example.com',
        domain: 'example.com',
        workspaceId: 'workspace-123',
        nextRun: expect.any(Date),
      });
      expect(result[1]).toEqual({
        jobId: 'scheduled-scan:workspace-456:test.com',
        domain: 'test.com',
        workspaceId: 'workspace-456',
        nextRun: expect.any(Date),
      });
    });

    it('should handle empty repeatable jobs', async () => {
      const { scheduledScanQueue, getScheduledScans } = await import('./bullmq.config');

      (scheduledScanQueue.getRepeatableJobs as any).mockResolvedValue([]);

      const result = await getScheduledScans();

      expect(result).toEqual([]);
    });

    it('should handle jobs without next run time', async () => {
      const { scheduledScanQueue, getScheduledScans } = await import('./bullmq.config');

      const mockRepeatableJobs = [
        { key: 'scheduled-scan:workspace-123:example.com', next: null },
      ];

      (scheduledScanQueue.getRepeatableJobs as any).mockResolvedValue(mockRepeatableJobs);

      const result = await getScheduledScans();

      expect(result).toHaveLength(1);
      expect(result[0].nextRun).toBeNull();
    });
  });
});

describe('Scheduled Scan Worker (V1-09)', () => {
  // This would require more extensive mocking of Prisma and @inboxshield/engine
  // For now, we verify the module exports correctly.
  // Longer timeout: imports PrismaClient + the real BullMQ graph on a cold process.
  it('should export scheduledScanWorker', async () => {
    const { scheduledScanWorker } = await import('./scheduled.scan.worker');
    expect(scheduledScanWorker).toBeDefined();
  }, 10_000);
});