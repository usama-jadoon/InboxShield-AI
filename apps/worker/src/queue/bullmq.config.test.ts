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
      getJob: vi.fn().mockResolvedValue(null),
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
    it('should find and remove the repeatable job by matching logical jobId', async () => {
      const { scheduledScanQueue, removeScheduledScan } = await import('./bullmq.config');

      const mockRepeatableJobs = [
        { key: 'a1b2c3d4e5f67890', name: 'execute-scheduled-scan', next: Date.now() + 86400000 },
        { key: 'f6e5d4c3b2a19876', name: 'other-job', next: Date.now() + 43200000 },
      ];

      const mockGetJob = vi.fn()
        .mockResolvedValueOnce({
          opts: { repeat: { jobId: 'scheduled-scan:workspace-123:example.com' } }
        })
        .mockResolvedValueOnce(null);

      (scheduledScanQueue.getRepeatableJobs as any).mockResolvedValue(mockRepeatableJobs);
      (scheduledScanQueue.getJob as any).mockImplementation(mockGetJob);
      (scheduledScanQueue.removeRepeatableByKey as any).mockResolvedValue(true);

      await removeScheduledScan('example.com', 'workspace-123');

      // Should call removeRepeatableByKey with the BullMQ internal key
      expect(scheduledScanQueue.removeRepeatableByKey).toHaveBeenCalledWith('a1b2c3d4e5f67890');
    });

    it('should fallback to logical jobId when no match found', async () => {
      const { scheduledScanQueue, removeScheduledScan } = await import('./bullmq.config');

      (scheduledScanQueue.getRepeatableJobs as any).mockResolvedValue([]);
      (scheduledScanQueue.removeRepeatableByKey as any).mockResolvedValue(true);

      await removeScheduledScan('example.com', 'workspace-123');

      expect(scheduledScanQueue.removeRepeatableByKey).toHaveBeenCalledWith('scheduled-scan:workspace-123:example.com');
    });
  });

  describe('getScheduledScans', () => {
    it('should return formatted scheduled scans from repeatable jobs (real BullMQ shape)', async () => {
      const { scheduledScanQueue, getScheduledScans } = await import('./bullmq.config');

      // Real BullMQ returns md5-hashed keys, not the logical jobId.
      // The logical jobId is in opts.repeat.jobId of the generated repeat job.
      const mockRepeatableJobs = [
        { key: 'a1b2c3d4e5f67890', name: 'execute-scheduled-scan', next: Date.now() + 86400000 },
        { key: 'f6e5d4c3b2a19876', name: 'execute-scheduled-scan', next: Date.now() + 43200000 },
        { key: 'other-job-key', name: 'other-job', next: Date.now() + 10000 }, // Should be filtered out
      ];

      // Mock getJob to return the logical jobId for each repeatable key
      const mockGetJob = vi.fn()
        .mockResolvedValueOnce({
          opts: { repeat: { jobId: 'scheduled-scan:workspace-123:example.com' } }
        })
        .mockResolvedValueOnce({
          opts: { repeat: { jobId: 'scheduled-scan:workspace-456:test.com' } }
        })
        .mockResolvedValueOnce(null);

      (scheduledScanQueue.getRepeatableJobs as any).mockResolvedValue(mockRepeatableJobs);
      (scheduledScanQueue.getJob as any).mockImplementation(mockGetJob);

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
        { key: 'a1b2c3d4e5f67890', name: 'execute-scheduled-scan', next: null },
      ];

      (scheduledScanQueue.getRepeatableJobs as any).mockResolvedValue(mockRepeatableJobs);
      (scheduledScanQueue.getJob as any).mockResolvedValue({
        opts: { repeat: { jobId: 'scheduled-scan:workspace-123:example.com' } }
      });

      const result = await getScheduledScans();

      expect(result).toHaveLength(1);
      expect(result[0].nextRun).toBeNull();
    });

    it('should fallback to key when getJob returns null', async () => {
      const { scheduledScanQueue, getScheduledScans } = await import('./bullmq.config');

      const mockRepeatableJobs = [
        { key: 'fallback-key', name: 'execute-scheduled-scan', next: Date.now() + 86400000 },
      ];

      (scheduledScanQueue.getRepeatableJobs as any).mockResolvedValue(mockRepeatableJobs);
      (scheduledScanQueue.getJob as any).mockResolvedValue(null);

      const result = await getScheduledScans();

      expect(result).toHaveLength(1);
      expect(result[0].jobId).toBe('fallback-key');
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