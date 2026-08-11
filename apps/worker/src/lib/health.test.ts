import { describe, it, expect, vi, beforeEach } from 'vitest';

// The health module imports the shared BullMQ Redis connection, so mock the
// Redis/Queue layer to avoid real connections during tests (same pattern as
// bullmq.config.test.ts).
vi.mock('ioredis', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      quit: vi.fn().mockResolvedValue('OK'),
    })),
  };
});

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

import { checkHealth, isHealthy } from './health';

/** Fake Redis probe — exact command surface checkHealth uses (ping). */
function redis(ping: () => Promise<string> | never) {
  return { ping };
}

/** Fake DB probe — exact command surface checkHealth uses ($queryRaw). */
function db(result: () => Promise<unknown> | never) {
  return { $queryRaw: () => result() };
}

describe('checkHealth (V1-12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports both dependencies up when probes succeed', async () => {
    const report = await checkHealth(
      redis(() => Promise.resolve('PONG')),
      db(() => Promise.resolve([{ '?column?': 1 }])),
    );
    expect(report).toEqual({ redis: 'up', db: 'up' });
    expect(isHealthy(report)).toBe(true);
  });

  it('reports redis down when ping rejects', async () => {
    const report = await checkHealth(
      redis(() => Promise.reject(new Error('ECONNREFUSED'))),
      db(() => Promise.resolve([{ '?column?': 1 }])),
    );
    expect(report).toEqual({ redis: 'down', db: 'up' });
    expect(isHealthy(report)).toBe(false);
  });

  it('reports db down when SELECT 1 rejects', async () => {
    const report = await checkHealth(
      redis(() => Promise.resolve('PONG')),
      db(() => Promise.reject(new Error('connection refused'))),
    );
    expect(report).toEqual({ redis: 'up', db: 'down' });
    expect(isHealthy(report)).toBe(false);
  });

  it('reports both down when both probes reject', async () => {
    const report = await checkHealth(
      redis(() => Promise.reject(new Error('down'))),
      db(() => Promise.reject(new Error('down'))),
    );
    expect(report).toEqual({ redis: 'down', db: 'down' });
    expect(isHealthy(report)).toBe(false);
  });

  it('treats a hung dependency as down after the probe timeout', async () => {
    const never = () => new Promise<never>(() => {});
    const report = await checkHealth(redis(never), db(never), 20);
    expect(report).toEqual({ redis: 'down', db: 'down' });
  });

  it('does not let a slow-but-live dependency flip the result after settling', async () => {
    // Resolve after the 20ms timeout would have fired — the probe already
    // resolved as 'down' at 20ms; a late settle must not change the report.
    const late = () => new Promise<string>(resolve => setTimeout(() => resolve('PONG'), 60));
    const report = await checkHealth(redis(late), db(() => Promise.resolve([{ '?column?': 1 }])), 20);
    expect(report).toEqual({ redis: 'down', db: 'up' });
    expect(isHealthy(report)).toBe(false);
  });
});
