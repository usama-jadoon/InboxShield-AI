/**
 * @file V1-12: Health check probes for the worker data plane.
 *
 * `checkHealth()` verifies the two core dependencies of the data plane:
 *   - Redis (BullMQ connection) via `PING`
 *   - PostgreSQL (Prisma client) via `SELECT 1`
 *
 * Each probe is race-guarded by a short timeout so a hung dependency cannot
 * block the /health endpoint indefinitely. A probe result is either 'up' or
 * 'down' — never a fabricated success.
 */
import { prisma } from '@inboxshield/db';
import { connection } from '../queue/bullmq.config';

export type HealthComponent = 'db' | 'redis';
export type HealthStatus = 'up' | 'down';
export type HealthReport = Record<HealthComponent, HealthStatus>;

const PROBE_TIMEOUT_MS = 2_000;

interface RedisProbe {
  ping(): Promise<string>;
}

interface DbProbe {
  $queryRaw(strings: TemplateStringsArray): Promise<unknown>;
}

/**
 * Race a promise against a fallback timer. The timer is cleared on settle so
 * no lingering timeout keeps the process alive after a fast probe.
 */
function raceTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>(resolve => {
    const timer = setTimeout(() => resolve(fallback), ms);
    promise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}

export async function checkHealth(
  redis: RedisProbe = connection,
  db: DbProbe = prisma,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<HealthReport> {
  const [redisUp, dbUp] = await Promise.all([
    raceTimeout(
      redis.ping().then(
        () => true,
        () => false,
      ),
      timeoutMs,
      false,
    ),
    raceTimeout(
      db.$queryRaw`SELECT 1`.then(
        () => true,
        () => false,
      ),
      timeoutMs,
      false,
    ),
  ]);

  return {
    redis: redisUp ? 'up' : 'down',
    db: dbUp ? 'up' : 'down',
  };
}

export function isHealthy(report: HealthReport): boolean {
  return report.db === 'up' && report.redis === 'up';
}
