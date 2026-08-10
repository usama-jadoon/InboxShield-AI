import { Worker, Job } from 'bullmq';
import { EngineOrchestrator, DnsScanner, SpfScanner, DkimScanner, DmarcScanner, MxScanner, TlsScanner, BlacklistScanner, IpBlacklistScanner } from '@inboxshield/engine';
import { scanQueueName, connection } from './bullmq.config';
import { logger } from '../lib/logger';

export const scanWorker = new Worker(
  scanQueueName,
  async (job: Job) => {
    const { domain } = job.data as { domain: string };
    const log = logger.child({ correlationId: job.id, domain });

    log.info('processing scan');

    // Initialize engine orchestrator with canonical scanners
    const orchestrator = new EngineOrchestrator();
    orchestrator.registerScanner(new DnsScanner());
    orchestrator.registerScanner(new SpfScanner());
    orchestrator.registerScanner(new DkimScanner());
    orchestrator.registerScanner(new DmarcScanner());
    orchestrator.registerScanner(new MxScanner());
    orchestrator.registerScanner(new TlsScanner());
    orchestrator.registerScanner(new BlacklistScanner());
    orchestrator.registerScanner(new IpBlacklistScanner());

    // Execute canonical engine scan
    const report = await orchestrator.analyzeDomain(domain);

    log.info({ score: report.globalScore, riskLevel: report.riskLevel }, 'scan completed');

    return {
      status: 'completed',
      domain: report.domain,
      score: report.globalScore,
      riskLevel: report.riskLevel,
      scannerResults: report.scannerResults
    };
  },
  {
    connection,
    concurrency: 10, // Fewer concurrent scans (heavier than webhooks)
  }
);

scanWorker.on('completed', (_job) => {
  // Structured log on completion is handled inline above.
});

scanWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'scan job failed');
});
