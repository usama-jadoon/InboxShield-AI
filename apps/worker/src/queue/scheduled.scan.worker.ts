import { Worker, Job } from 'bullmq';
import {
  EngineOrchestrator,
  DnsScanner,
  SpfScanner,
  DkimScanner,
  DmarcScanner,
  MxScanner,
  TlsScanner,
  BlacklistScanner,
  IpBlacklistScanner,
  HeuristicAiProvider,
  ReportBuilder,
} from '@inboxshield/engine';
import { PrismaClient, ScanService } from '@inboxshield/db';
import { scheduledScanQueueName, connection } from '../queue/bullmq.config';
import { logger } from '../lib/logger';

const prisma = new PrismaClient();
const aiProvider = new HeuristicAiProvider();

/**
 * Scheduled scan worker (V1-09).
 *
 * Processes repeatable jobs from the scheduled-scans queue, executes
 * canonical engine scans for domains, and persists ScanReport snapshots
 * to PostgreSQL via Prisma.
 */
export const scheduledScanWorker = new Worker(
  scheduledScanQueueName,
  async (job: Job) => {
    const { domain, workspaceId } = job.data as { domain: string; workspaceId: string };
    const log = logger.child({ correlationId: job.id, domain, workspaceId });

    log.info('processing scheduled scan');

    // Verify domain exists and belongs to workspace
    const dbDomain = await prisma.domain.findFirst({
      where: { domainName: domain, workspaceId },
    });

    if (!dbDomain) {
      log.warn('scheduled scan skipped — domain not found in workspace');
      return { status: 'skipped', reason: 'domain_not_found' };
    }

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

    // Build the canonical immutable ReportModel evidence snapshot — same flow as
    // /api/scan: deterministic flags → HeuristicAiProvider recommendations → ReportBuilder.
    const recommendations = await aiProvider.analyze(report);
    const reportModel = ReportBuilder.build(report, recommendations);

    log.info({ score: report.globalScore, riskLevel: report.riskLevel }, 'scheduled scan completed');

    // Persist the immutable evidence snapshot via the shared ScanService
    const scanReport = await ScanService.persist(prisma, dbDomain.id, reportModel);

    return {
      status: 'completed',
      scanReportId: scanReport.id,
      domain: report.domain,
      score: report.globalScore,
      riskLevel: report.riskLevel,
      scannerResults: report.scannerResults,
    };
  },
  {
    connection,
    concurrency: 5, // Fewer concurrent scheduled scans (heavier than webhooks)
  }
);

scheduledScanWorker.on('completed', (_job) => {
  // console.log(`Scheduled Scan Job ${job.id} completed!`);
});

scheduledScanWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'scheduled scan job failed');
});