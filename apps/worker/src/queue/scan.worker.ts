import { Worker, Job } from 'bullmq';
import { EngineOrchestrator, DnsScanner, SpfScanner, DkimScanner, DmarcScanner, MxScanner, TlsScanner, BlacklistScanner, IpBlacklistScanner } from '@inboxshield/engine';
import { scanQueueName, connection } from './bullmq.config';

export const scanWorker = new Worker(
  scanQueueName,
  async (job: Job) => {
    const { domain } = job.data as { domain: string };

    console.log(`Processing Scan Job ${job.id} for domain: ${domain}`);

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

    console.log(`Scan ${job.id} completed for ${domain}: score=${report.globalScore}, risk=${report.riskLevel}`);

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
  // console.log(`Scan Job ${job.id} completed!`);
});

scanWorker.on('failed', (job, err) => {
  console.error(`Scan Job ${job?.id} failed with error: ${err.message}`);
});