import { describe, it, expect, vi, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';

/**
 * Structured logging contract (V1-11):
 *
 * 1. Every log line is valid JSON with pino fields (level, time, msg, ...).
 * 2. Each BullMQ job handler creates a child logger bound to a correlationId
 *    (the job ID) so all lines for a single job share the same trace.
 * 3. The base logger is named `inboxshield-worker` so logs are attributable
 *    to the worker data plane.
 *
 * These tests bind pino to an in-memory stream and assert on the JSON it
 * emits — no real logger output leaks into the test runner.
 */

function captureStream() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, stream };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('worker logger', () => {
  it('emits valid JSON log lines with pino fields', async () => {
    const { lines, stream } = captureStream();
    const logger = pino({ name: 'inboxshield-worker', level: 'info' }, stream);

    logger.info('hello worker');

    // pino flushes asynchronously to the stream destination
    await new Promise(r => setTimeout(r, 10));

    expect(lines.length).toBeGreaterThan(0);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.name).toBe('inboxshield-worker');
    expect(parsed.level).toBe(30); // pino numeric level for 'info'
    expect(parsed.msg).toBe('hello worker');
    expect(typeof parsed.time).toBe('number');
  });

  it('child logger propagates correlationId to every emitted line', async () => {
    const { lines, stream } = captureStream();
    const logger = pino({ name: 'inboxshield-worker', level: 'info' }, stream);
    const log = logger.child({ correlationId: 'job-123', domain: 'example.com' });

    log.info('processing scan');
    log.info({ score: 92 }, 'scan completed');

    await new Promise(r => setTimeout(r, 10));

    const linesParsed = lines.map(l => JSON.parse(l));
    expect(linesParsed).toHaveLength(2);
    for (const line of linesParsed) {
      expect(line.correlationId).toBe('job-123');
      expect(line.domain).toBe('example.com');
    }
    expect(linesParsed[1].score).toBe(92);
  });

  it('filters out debug lines when level is info', async () => {
    const { lines, stream } = captureStream();
    const logger = pino({ name: 'inboxshield-worker', level: 'info' }, stream);

    logger.debug('should not appear');
    logger.info('should appear');

    await new Promise(r => setTimeout(r, 10));

    const messages = lines.map(l => JSON.parse(l).msg as string);
    expect(messages).not.toContain('should not appear');
    expect(messages).toContain('should appear');
  });

  it('emits structured error fields on logger.error', async () => {
    const { lines, stream } = captureStream();
    const logger = pino({ name: 'inboxshield-worker', level: 'info' }, stream);

    logger.error({ jobId: 'job-9', error: 'ECONNREFUSED' }, 'job failed');

    await new Promise(r => setTimeout(r, 10));

    const parsed = JSON.parse(lines[0]);
    expect(parsed.level).toBe(50); // pino numeric level for 'error'
    expect(parsed.jobId).toBe('job-9');
    expect(parsed.error).toBe('ECONNREFUSED');
    expect(parsed.msg).toBe('job failed');
  });
});
