/**
 * @file V1-03: ScanReport persistence service (AC-03).
 *
 * Writes a complete ReportModel snapshot to the ScanReport table.
 * The reportModel column is the immutable evidence snapshot per the
 * deterministic evidence contract (CLAUDE.md §11).
 */
import type { PrismaClient, ScanReport } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import type { ReportModel } from '@inboxshield/engine';

export class ScanError extends Error {
  readonly code: ScanErrorCode;
  constructor(code: ScanErrorCode, message: string) {
    super(message);
    this.name = 'ScanError';
    this.code = code;
  }
}

export type ScanErrorCode = 'NOT_FOUND' | 'DOMAIN_NOT_IN_WORKSPACE';

export class ScanService {
  /**
   * Persist a completed scan result. The caller must supply a fully
   * constructed ReportModel (via ReportBuilder.build) — the service does
   * NOT run any scans itself.
   */
  static async persist(
    client: PrismaClient,
    domainId: string,
    reportModel: ReportModel,
  ): Promise<ScanReport> {
    return client.scanReport.create({
      data: {
        domainId,
        score: reportModel.executiveSummary.score,
        riskLevel: reportModel.executiveSummary.riskLevel,
        reportModel: reportModel as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * List recent scan reports for a domain, most recent first.
   */
  static async listByDomain(
    client: PrismaClient,
    domainId: string,
    limit = 10,
  ): Promise<ScanReport[]> {
    return client.scanReport.findMany({
      where: { domainId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Fetch a single scan report by id, scoped to a domain (V1-10 export).
   * Returns null if the report does not exist or does not belong to the domain.
   */
  static async getById(
    client: PrismaClient,
    domainId: string,
    scanId: string,
  ): Promise<ScanReport | null> {
    return client.scanReport.findFirst({
      where: { id: scanId, domainId },
    });
  }

  /**
   * Fetch the most recent scan report for a domain (V1-10 PDF export).
   * Returns null when no reports exist for the domain.
   */
  static async getLatestForDomain(
    client: PrismaClient,
    domainId: string,
  ): Promise<ScanReport | null> {
    return client.scanReport.findFirst({
      where: { domainId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
