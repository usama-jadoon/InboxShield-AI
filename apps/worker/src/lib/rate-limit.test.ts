import { describe, it, expect, beforeEach } from 'vitest';
import { RedisRateLimiter } from './rate-limit';
import type { RateLimiter } from '@inboxshield/types';

/**
 * In-memory fake Redis exposing the exact command surface RedisRateLimiter
 * uses (INCR, EXPIRE, TTL). No live Redis is required to run these tests.
 */
class FakeRedis {
  private store = new Map<string, { count: number; expiresAt: number | null }>();
  failCommands = false;
  now = 0; // ms, controllable via advance()

  async incr(key: string): Promise<number> {
    if (this.failCommands) throw new Error('ECONNREFUSED (fake)');
    let entry = this.store.get(key);
    if (!entry || (entry.expiresAt !== null && entry.expiresAt <= this.now)) {
      entry = { count: 0, expiresAt: null };
      this.store.set(key, entry);
    }
    entry.count += 1;
    return entry.count;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.failCommands) throw new Error('ECONNREFUSED (fake)');
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = this.now + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    if (this.failCommands) throw new Error('ECONNREFUSED (fake)');
    const entry = this.store.get(key);
    if (!entry || entry.expiresAt === null) return -1;
    const remaining = Math.ceil((entry.expiresAt - this.now) / 1000);
    return Math.max(remaining, 0);
  }

  advance(ms: number): void {
    this.now += ms;
  }
}

describe('RedisRateLimiter', () => {
  let redis: FakeRedis;
  let limiter: RedisRateLimiter;

  beforeEach(() => {
    redis = new FakeRedis();
    limiter = new RedisRateLimiter(redis, { limit: 10, windowSeconds: 60 });
  });

  it('satisfies the shared RateLimiter interface contract', () => {
    const checkFn: RateLimiter['check'] = limiter.check.bind(limiter);
    expect(typeof checkFn).toBe('function');
  });

  it('allows requests within the budget and reports remaining', async () => {
    const result = await limiter.check('example.com');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('decrements remaining per request', async () => {
    for (let i = 0; i < 5; i++) {
      const r = await limiter.check('example.com');
      expect(r.allowed).toBe(true);
    }
    const result = await limiter.check('example.com');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('blocks after the budget is exhausted with a positive retryAfterSeconds', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await limiter.check('example.com');
      expect(r.allowed).toBe(true);
    }
    const result = await limiter.check('example.com');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keys are independent per key', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('a.example.com');
    }
    const exhausted = await limiter.check('a.example.com');
    expect(exhausted.allowed).toBe(false);

    const fresh = await limiter.check('b.example.com');
    expect(fresh.allowed).toBe(true);
  });

  it('resets the window after the window elapses', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('example.com');
    }
    expect((await limiter.check('example.com')).allowed).toBe(false);

    // Advance past the 60s window.
    redis.advance(61_000);

    const afterWindow = await limiter.check('example.com');
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(9);
  });

  it('returns retryAfterSeconds based on remaining window', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('example.com');
    }
    redis.advance(30_000); // half the 60s window elapsed
    const result = await limiter.check('example.com');
    expect(result.allowed).toBe(false);
    // ~30s remain in the window.
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(28);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(30);
  });

  it('fails open (allows) when Redis commands error by default', async () => {
    redis.failCommands = true;
    const result = await limiter.check('example.com');
    expect(result.allowed).toBe(true);
  });

  it('rethrows the Redis error when failOpen is false', async () => {
    const strict = new RedisRateLimiter(redis, {
      limit: 10,
      windowSeconds: 60,
      failOpen: false,
    });
    redis.failCommands = true;
    await expect(strict.check('example.com')).rejects.toThrow('ECONNREFUSED');
  });

  it('honors a custom limit', async () => {
    const small = new RedisRateLimiter(redis, { limit: 2, windowSeconds: 60 });
    expect((await small.check('example.com')).allowed).toBe(true);
    expect((await small.check('example.com')).allowed).toBe(true);
    expect((await small.check('example.com')).allowed).toBe(false);
  });
});
