/**
 * @file V1-05: DashboardService unit tests (AC-04).
 *
 * Verifies workspace-level aggregate stats against a hand-crafted Prisma
 * mock. No database required — all queries are vi.fn() stubs.
 */
import { describe, it, expect, vi } from 'vitest';
import { DashboardService } from './dashboard.service';

const WORKSPACE_ID = 'ws-dash';

const DOMAINS = [
  { id: 'dom-1', domainName: 'example.com' },
  { id: 'dom-2', domainName: 'test.net' },
  { id: 'dom-3', domainName: 'corp.org' },
];

function makeScanCounts() {
  return [
    { domainId: 'dom-1', _count: { id: 4 } },
    { domainId: 'dom-2', _count: { id: 2 } },
  ];
}

function latestScanFor(domainId: string) {
  const byDomain: Record<string, { score: number; riskLevel: string }> = {
    'dom-1': { score: 92, riskLevel: 'LOW' },
    'dom-2': { score: 45, riskLevel: 'HIGH' },
    'dom-3': { score: 30, riskLevel: 'CRITICAL' },
  };
  return byDomain[domainId];
}

function makeClient() {
  const findMany = vi.fn().mockResolvedValue(DOMAINS);
  const groupBy = vi.fn().mockResolvedValue(makeScanCounts());
  const findFirst = vi.fn().mockImplementation(async ({ where }: { where: { domainId: string } }) => {
    const latest = latestScanFor(where.domainId);
    return latest ? { score: latest.score, riskLevel: latest.riskLevel } : null;
  });
  return { domain: { findMany }, scanReport: { groupBy, findFirst } } as never;
}

describe('DashboardService.getWorkspaceStats', () => {
  it('returns empty stats when the workspace has no domains', async () => {
    const client = {
      domain: { findMany: vi.fn().mockResolvedValue([]) },
    } as never;

    const stats = await DashboardService.getWorkspaceStats(client, WORKSPACE_ID);

    expect(stats).toEqual({
      totalDomains: 0,
      totalScans: 0,
      averageScore: null,
      incidentCount: 0,
      domains: [],
    });
  });

  it('aggregates domain count, scan counts, and latest scores', async () => {
    const client = makeClient();
    const stats = await DashboardService.getWorkspaceStats(client, WORKSPACE_ID);

    expect(stats.totalDomains).toBe(3);
    expect(stats.totalScans).toBe(6);
    expect(stats.domains).toHaveLength(3);
    expect(stats.domains[0]).toEqual({
      domainId: 'dom-1',
      domainName: 'example.com',
      latestScore: 92,
      latestRiskLevel: 'LOW',
      scanCount: 4,
    });
  });

  it('counts incidents as domains with HIGH or CRITICAL latest risk', async () => {
    const client = makeClient();
    const stats = await DashboardService.getWorkspaceStats(client, WORKSPACE_ID);

    expect(stats.incidentCount).toBe(2);
  });

  it('computes the average score across scored domains', async () => {
    const client = makeClient();
    const stats = await DashboardService.getWorkspaceStats(client, WORKSPACE_ID);

    // (92 + 45 + 30) / 3 = 167 / 3 ≈ 56
    expect(stats.averageScore).toBe(56);
  });

  it('reports null score fields for domains with no scans', async () => {
    const client = {
      domain: { findMany: vi.fn().mockResolvedValue([{ id: 'dom-1', domainName: 'example.com' }]) },
      scanReport: {
        groupBy: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never;

    const stats = await DashboardService.getWorkspaceStats(client, WORKSPACE_ID);

    expect(stats.totalScans).toBe(0);
    expect(stats.averageScore).toBeNull();
    expect(stats.incidentCount).toBe(0);
    expect(stats.domains[0].latestScore).toBeNull();
    expect(stats.domains[0].latestRiskLevel).toBeNull();
    expect(stats.domains[0].scanCount).toBe(0);
  });

  it('queries domains scoped to the workspace', async () => {
    const client = makeClient();
    await DashboardService.getWorkspaceStats(client, WORKSPACE_ID);

    expect(client.domain.findMany).toHaveBeenCalledWith({
      where: { workspaceId: WORKSPACE_ID },
      select: { id: true, domainName: true },
    });
  });

  it('queries latest scan per domain by createdAt descending', async () => {
    const client = makeClient();
    await DashboardService.getWorkspaceStats(client, WORKSPACE_ID);

    expect(client.scanReport.findFirst).toHaveBeenCalledWith({
      where: { domainId: 'dom-1' },
      orderBy: { createdAt: 'desc' },
      select: { score: true, riskLevel: true },
    });
  });

  it('restricts scan-count grouping to workspace domain ids', async () => {
    const client = makeClient();
    await DashboardService.getWorkspaceStats(client, WORKSPACE_ID);

    expect(client.scanReport.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['domainId'],
        _count: { id: true },
        where: { domainId: { in: ['dom-1', 'dom-2', 'dom-3'] } },
      }),
    );
  });
});
