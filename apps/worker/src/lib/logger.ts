/**
 * @file V1-11: Structured pino logger for the worker data plane.
 *
 * Replaces all console.log / console.warn / console.error calls with
 * structured JSON logging. The base logger is module-level; each BullMQ
 * job handler creates a child logger with a correlation ID (the job ID)
 * so that all log lines for a single job share the same trace.
 *
 * For Fastify HTTP handlers, use `request.log` (already pino-backed with
 * its own `reqId` correlation) rather than this module.
 */
import pino from 'pino';

export const logger = pino({
  name: 'inboxshield-worker',
  level: process.env.LOG_LEVEL ?? 'info',
});
