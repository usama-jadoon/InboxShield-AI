import { describe, it, expect, beforeEach } from 'vitest';
import { LocalMemoryRateLimiter, RateLimiter } from './rate-limit';

describe('LocalMemoryRateLimiter', () => {
  let limiter: LocalMemoryRateLimiter;

  beforeEach(() => {
    limiter = new LocalMemoryRateLimiter();
  });

  it('satisfies the RateLimiter interface contract', () => {
    const checkFn: RateLimiter['check'] = limiter.check.bind(limiter);
    expect(typeof checkFn).toBe('function');
  });

  it('allows requests within the budget', async () => {
    const result = await limiter.check('example.com');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9); // 10 - 1
  });

  it('decrements the remaining count per request', async () => {
    for (let i = 0; i < 5; i++) {
      const result = await limiter.check('example.com');
      expect(result.allowed).toBe(true);
    }
    const result = await limiter.check('example.com');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4); // 10 - 6
  });

  it('blocks after the budget is exhausted', async () => {
    for (let i = 0; i < 10; i++) {
      const result = await limiter.check('example.com');
      expect(result.allowed).toBe(true);
    }
    const result = await limiter.check('example.com');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('keys are independent per domain', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('a.example.com');
    }
    // a.example.com is exhausted, but b.example.com is fresh
    const exhausted = await limiter.check('a.example.com');
    expect(exhausted.allowed).toBe(false);

    const fresh = await limiter.check('b.example.com');
    expect(fresh.allowed).toBe(true);
  });

  it('reset clears all buckets', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('example.com');
    }
    const exhausted = await limiter.check('example.com');
    expect(exhausted.allowed).toBe(false);

    limiter.reset();

    const afterReset = await limiter.check('example.com');
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(9);
  });

  it('returns a positive retryAfterSeconds when blocked', async () => {
    for (let i = 0; i < 10; i++) {
      await limiter.check('example.com');
    }
    const result = await limiter.check('example.com');
    expect(result.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
