/**
 * RateLimiter — pluggable interface for per-key request throttling.
 *
 * The contract:
 *   `check(key)` returns `{ allowed: boolean, retryAfterSeconds?, remaining? }`.
 *
 * Phase 0 ships LocalMemoryRateLimiter which is explicitly **single-process,
 * non-persistent, and NOT production protection**.  A production deployment
 * must swap this for RedisRateLimiter (same interface, Redis-backed via INCR
 * + EXPIRE or BullMQ's Redis connection) — see docs/PHASE_0_IMPLEMENTATION_CONTRACT.md §P0-08.
 */

export interface RateLimiter {
  check(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number; remaining?: number }>;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const REFILL_INTERVAL_MS = 60_000; // 1 minute window
const MAX_TOKENS = 10;              // 10 requests per window per key

/**
 * LocalMemoryRateLimiter — in-process, per-domain token bucket.
 *
 * Limitations (documented for awareness):
 * - Resets on process restart (no persistence)
 * - Does NOT work across multiple instances / pods
 * - NOT production protection — use RedisRateLimiter (Phase 1)
 */
export class LocalMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  async check(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number; remaining?: number }> {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    // Refill tokens if the window has elapsed
    if (!bucket || (now - bucket.lastRefill) >= REFILL_INTERVAL_MS) {
      bucket = { tokens: MAX_TOKENS, lastRefill: now };
    }

    if (bucket.tokens > 0) {
      bucket.tokens -= 1;
      this.buckets.set(key, bucket);
      return { allowed: true, remaining: bucket.tokens };
    }

    // No tokens left — compute when the window resets
    const retryAfterSeconds = Math.ceil(
      (REFILL_INTERVAL_MS - (now - bucket.lastRefill)) / 1000
    );
    this.buckets.set(key, bucket);
    return { allowed: false, retryAfterSeconds: Math.max(retryAfterSeconds, 1) };
  }

  /** Reset all buckets (useful in tests). */
  reset(): void {
    this.buckets.clear();
  }
}
