/**
 * @file V1-05: Dashboard aggregate stats from DB (AC-04).
 *
 * Provides workspace-level statistics for the dashboard: domain count,
 * average score, incident count, and per-domain latest-scan summary.
 * All queries are single-connection Prisma reads — no transactions needed
 * since we only read snapshots that are append-only.
 */
import type { PrismaClient } from '@prisma/client';

export interface DomainSummary {
  domainId: string;
  domainName: string;
  latestScore: number | null;
  latestRiskLevel: string | null;
  scanCount: number;
}

export interface WorkspaceStats {
  totalDomains: number;
  totalScans: number;
  averageScore: number | null;
  incidentCount: number;
  domains: DomainSummary[];
}

export class DashboardService {
  /**
   * Aggregate dashboard stats for a workspace.
   * Returns real data from the ScanReport and Domain tables.
   */
  static async getWorkspaceStats(
    client: PrismaClient,
    workspaceId: string,
  ): Promise<WorkspaceStats> {
    // 1. Get all domains in the workspace.
    const domains = await client.domain.findMany({
      where: { workspaceId },
      select: { id: true, domainName: true },
    });

    if (domains.length === 0) {
      return {
        totalDomains: 0,
        totalScans: 0,
        averageScore: null,
        incidentCount: 0,
        domains: [],
      };
    }

    const domainIds = domains.map((d) => d.id);

    // 2. Get scan counts per domain.
    const scanCounts = await client.scanReport.groupBy({
      by: ['domainId'],
      _count: { id: true },
      where: { domainId: { in: domainIds } },
    });
    const scanCountMap = new Map(
      scanCounts.map((sc) => [sc.domainId, sc._count.id]),
    );

    // 3. Get total scan count across workspace.
    const totalScans = scanCounts.reduce((acc, sc) => acc + sc._count.id, 0);

    // 4. For each domain, get the latest scan (by createdAt desc).
    const domainSummaries: DomainSummary[] = [];

    for (const domain of domains) {
      const latestScan = await client.scanReport.findFirst({
        where: { domainId: domain.id },
        orderBy: { createdAt: 'desc' },
        select: { score: true, riskLevel: true },
      });

      domainSummaries.push({
        domainId: domain.id,
        domainName: domain.domainName,
        latestScore: latestScan?.score ?? null,
        latestRiskLevel: latestScan?.riskLevel ?? null,
        scanCount: scanCountMap.get(domain.id) ?? 0,
      });
    }

    // 5. Compute average score across domains with scans.
    const scoredDomains = domainSummaries.filter(
      (d) => d.latestScore !== null,
    );
    const averageScore =
      scoredDomains.length > 0
        ? Math.round(
            scoredDomains.reduce((sum, d) => sum + (d.latestScore ?? 0), 0) /
              scoredDomains.length,
          )
        : null;

    // 6. Count incidents (domains with HIGH or CRITICAL risk).
    const incidentCount = domainSummaries.filter(
      (d) =>
        d.latestRiskLevel === 'HIGH' || d.latestRiskLevel === 'CRITICAL',
    ).length;

    return {
      totalDomains: domains.length,
      totalScans,
      averageScore,
      incidentCount,
      domains: domainSummaries,
    };
  }
}
