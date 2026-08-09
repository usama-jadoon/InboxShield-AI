import type { RateLimiter, RateLimitResult } from '@inboxshield/types';

/**
 * Minimal Redis command surface RedisRateLimiter depends on.
 *
 * ioredis satisfies this structurally (INCR/EXPIRE/TTL), so callers pass a
 * real ioredis client in production while tests inject a fake — no live Redis
 * is required to exercise the limiter's logic.
 */
export interface RedisRateLimitClient {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ttl(key: string): Promise<number>;
}

/**
 * RedisRateLimiter — production Redis-backed rate limiter (V1-06).
 *
 * Implements the shared `RateLimiter` contract from `@inboxshield/types` using
 * a fixed-window counter via Redis `INCR` + `EXPIRE`:
 *
 *   INCR  <keyPrefix>:<key>
 *   EXPIRE <keyPrefix>:<key> <windowSeconds>   (only on first hit)
 *
 * A window is defined by the key's TTL. Once the counter reaches `limit`, the
 * limiter blocks with `retryAfterSeconds` set to the remaining window (TTL).
 *
 * Semantics match the web app's `LocalMemoryRateLimiter` (dev-only): 10
 * requests per 60s window per key by default. Because it is Redis-backed it
 * survives restarts and works across multiple instances/pods.
 *
 * Failure policy: by default Redis errors FAIL OPEN (`allowed: true`) so a
 * Redis outage degrades rate limiting to allow traffic rather than taking the
 * API down. Set `failOpen: false` to rethrow the Redis error instead.
 */
export class RedisRateLimiter implements RateLimiter {
  private readonly client: RedisRateLimitClient;
  private readonly limit: number;
  private readonly windowSeconds: number;
  private readonly keyPrefix: string;
  private readonly failOpen: boolean;

  constructor(client: RedisRateLimitClient, options: RedisRateLimiterOptions = {}) {
    this.client = client;
    this.limit = options.limit ?? DEFAULT_LIMIT;
    this.windowSeconds = options.windowSeconds ?? DEFAULT_WINDOW_SECONDS;
    this.keyPrefix = options.keyPrefix ?? 'inboxshield:ratelimit';
    this.failOpen = options.failOpen ?? true;
  }

  async check(key: string): Promise<RateLimitResult> {
    const redisKey = `${this.keyPrefix}:${key}`;
    try {
      const count = await this.client.incr(redisKey);
      // First request in the window establishes the expiry.
      if (count === 1) {
        await this.client.expire(redisKey, this.windowSeconds);
      }

      if (count <= this.limit) {
        return { allowed: true, remaining: Math.max(this.limit - count, 0) };
      }

      // Over budget — block until the current window expires.
      const ttl = await this.client.ttl(redisKey);
      return { allowed: false, retryAfterSeconds: Math.max(ttl, 1) };
    } catch (err) {
      if (this.failOpen) {
        return { allowed: true };
      }
      throw err;
    }
  }
}

export interface RedisRateLimiterOptions {
  /** Max requests per window per key. Default: 10. */
  limit?: number;
  /** Fixed window length in seconds. Default: 60. */
  windowSeconds?: number;
  /** Redis key prefix. Default: `inboxshield:ratelimit`. */
  keyPrefix?: string;
  /** When true (default), Redis errors allow the request through (fail open). */
  failOpen?: boolean;
}

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_SECONDS = 60;
