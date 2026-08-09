/**
 * @file V1-05: dashboard data-access tests (AC-04).
 *
 * Verifies that getDashboardData resolves session → workspace → real DB
 * stats and never falls back to hardcoded demo data. The page component
 * itself is exercised through these units.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { riskLevelForScore } from './dashboard-data';

const { mockPrisma, mockWorkspaceService, mockDashboardService } = vi.hoisted(() => ({
  mockPrisma: {
    domain: { findMany: vi.fn() },
    session: { findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
    scanReport: { groupBy: vi.fn(), findFirst: vi.fn() },
  },
  mockWorkspaceService: { resolveForSession: vi.fn() },
  mockDashboardService: { getWorkspaceStats: vi.fn() },
}));

vi.mock('@inboxshield/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@inboxshield/db')>();
  return {
    ...actual,
    prisma: mockPrisma,
    WorkspaceService: mockWorkspaceService,
    DashboardService: mockDashboardService,
  };
});

import { getDashboardData } from './dashboard-data';

const WORKSPACE = { id: 'ws-1', name: 'Acme', createdAt: new Date() };

const STATS = {
  totalDomains: 2,
  totalScans: 5,
  averageScore: 62,
  incidentCount: 1,
  domains: [
    {
      domainId: 'dom-1',
      domainName: 'example.com',
      latestScore: 92,
      latestRiskLevel: 'LOW',
      scanCount: 3,
    },
    {
      domainId: 'dom-2',
      domainName: 'client-b.com',
      latestScore: 32,
      latestRiskLevel: 'CRITICAL',
      scanCount: 2,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getDashboardData', () => {
  it('returns null when no token is present', async () => {
    const result = await getDashboardData('');
    expect(result).toBeNull();
    expect(mockWorkspaceService.resolveForSession).not.toHaveBeenCalled();
  });

  it('returns null when the token has no workspace', async () => {
    mockWorkspaceService.resolveForSession.mockResolvedValue(null);
    const result = await getDashboardData('tok');
    expect(result).toBeNull();
    expect(mockDashboardService.getWorkspaceStats).not.toHaveBeenCalled();
  });

  it('resolves the workspace and returns real DB stats', async () => {
    mockWorkspaceService.resolveForSession.mockResolvedValue(WORKSPACE);
    mockDashboardService.getWorkspaceStats.mockResolvedValue(STATS);

    const result = await getDashboardData('tok');

    expect(mockWorkspaceService.resolveForSession).toHaveBeenCalledWith(
      mockPrisma,
      'tok',
    );
    expect(mockDashboardService.getWorkspaceStats).toHaveBeenCalledWith(
      mockPrisma,
      'ws-1',
    );
    expect(result).not.toBeNull();
    expect(result!.stats.totalDomains).toBe(2);
    expect(result!.stats.incidentCount).toBe(1);
    expect(result!.globalRiskLevel).toBe('HIGH');
  });

  it('derives MEDIUM for scores between 70 and 90', async () => {
    expect(riskLevelForScore(84)).toBe('MEDIUM');
  });

  it('derives UNKNOWN for unscanned workspaces', async () => {
    expect(riskLevelForScore(null)).toBe('UNKNOWN');
  });

  it('derives CRITICAL for scores below 40', async () => {
    expect(riskLevelForScore(39)).toBe('CRITICAL');
  });

  it('derives HIGH for scores between 40 and 70', async () => {
    expect(riskLevelForScore(45)).toBe('HIGH');
  });

  it('derives LOW for scores at or above 90', async () => {
    expect(riskLevelForScore(95)).toBe('LOW');
  });
});
