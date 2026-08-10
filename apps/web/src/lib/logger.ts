/**
 * @file V1-11: Structured pino logger for the web control plane.
 *
 * Each API route creates a child logger with a correlation ID so that all
 * log lines for a single request are traceable end-to-end.
 *
 * Usage in API routes:
 *   import { logger } from '@/lib/logger';
 *   const req = logger.child({ correlationId: crypto.randomUUID() });
 *   req.info({ domainId }, 'scan history requested');
 */
import pino from 'pino';

export const logger = pino({
  name: 'inboxshield-web',
  level: process.env.LOG_LEVEL ?? 'info',
});
