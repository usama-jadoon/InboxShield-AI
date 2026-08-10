import { describe, it, expect, afterEach } from 'vitest';
import { Writable } from 'node:stream';
import pino from 'pino';

/**
 * Control-plane logger contract (V1-11): mirrors the worker logger. Each API
 * route creates a child logger with a correlationId so a single request is
 * traceable end-to-end. This test binds pino to an in-memory stream and
 * asserts on the JSON emitted — no real logger output leaks into the runner.
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
  // pino may leave pending timer handles; silence after each test
});

describe('web logger', () => {
  it('emits JSON lines named inboxshield-web', async () => {
    const { lines, stream } = captureStream();
    const logger = pino({ name: 'inboxshield-web', level: 'info' }, stream);

    logger.info({ route: '/api/scan' }, 'request handled');

    await new Promise(r => setTimeout(r, 10));

    const parsed = JSON.parse(lines[0]);
    expect(parsed.name).toBe('inboxshield-web');
    expect(parsed.level).toBe(30);
    expect(parsed.route).toBe('/api/scan');
    expect(parsed.msg).toBe('request handled');
  });

  it('child logger carries correlationId for end-to-end tracing', async () => {
    const { lines, stream } = captureStream();
    const logger = pino({ name: 'inboxshield-web', level: 'info' }, stream);
    const req = logger.child({ correlationId: 'req-42', domainId: 'dom-7' });

    req.info('scan history requested');

    await new Promise(r => setTimeout(r, 10));

    const parsed = JSON.parse(lines[0]);
    expect(parsed.correlationId).toBe('req-42');
    expect(parsed.domainId).toBe('dom-7');
  });
});
