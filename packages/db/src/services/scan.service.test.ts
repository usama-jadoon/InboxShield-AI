/**
 * @file V1-03: ScanService unit tests (AC-03).
 *
 * Verifies persist and listByDomain against a hand-crafted Prisma mock.
 * No database required — tests run against vi.fn() stubs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScanService } from './scan.service';

const DOMAIN_ID = 'dom-scan';

function makeReportModel(score = 92, riskLevel = 'LOW' as const) {
  return {
    metadata: { domain: 'example.com', generatedAt: '2026-08-09T00:00:00Z', version: '1.0.0' },
    executiveSummary: { score, riskLevel, statusText: 'Optimal', riskColor: 'emerald' as const },
    authentication: [],
    infrastructure: [],
    recommendations: [],
    technicalAppendix: {},
  };
}

describe('ScanService.persist', () => {
  it('creates a ScanReport with correct fields', async () => {
    const reportModel = makeReportModel(88, 'MEDIUM');
    const created = { id: 'sr-1', domainId: DOMAIN_ID, score: 88, riskLevel: 'MEDIUM', reportModel, createdAt: new Date() };
    const mockCreate = vi.fn().mockResolvedValue(created);

    const result = await ScanService.persist(
      { scanReport: { create: mockCreate } } as never,
      DOMAIN_ID,
      reportModel,
    );

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        domainId: DOMAIN_ID,
        score: 88,
        riskLevel: 'MEDIUM',
        reportModel: expect.objectContaining({ metadata: expect.any(Object) }),
      },
    });
    expect(result.id).toBe('sr-1');
    expect(result.score).toBe(88);
  });

  it('stores the full ReportModel as JSON', async () => {
    const reportModel = makeReportModel();
    const mockCreate = vi.fn().mockResolvedValue({ id: 'sr-2', reportModel });

    await ScanService.persist(
      { scanReport: { create: mockCreate } } as never,
      DOMAIN_ID,
      reportModel,
    );

    const passed = mockCreate.mock.calls[0][0].data.reportModel;
    expect(passed.executiveSummary.score).toBe(92);
    expect(passed.authentication).toEqual([]);
    expect(passed.technicalAppendix).toEqual({});
  });
});

describe('ScanService.listByDomain', () => {
  it('queries by domainId with descending createdAt order', async () => {
    const reports = [
      { id: 'sr-2', createdAt: new Date('2026-08-09T01:00:00Z') },
      { id: 'sr-1', createdAt: new Date('2026-08-09T00:00:00Z') },
    ];
    const mockFindMany = vi.fn().mockResolvedValue(reports);

    const result = await ScanService.listByDomain(
      { scanReport: { findMany: mockFindMany } } as never,
      DOMAIN_ID,
    );

    expect(mockFindMany).toHaveBeenCalledWith({
      where: { domainId: DOMAIN_ID },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('sr-2');
  });

  it('respects custom limit', async () => {
    const mockFindMany = vi.fn().mockResolvedValue([]);

    await ScanService.listByDomain(
      { scanReport: { findMany: mockFindMany } } as never,
      DOMAIN_ID,
      5,
    );

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });
});

describe('ScanService.getById', () => {
  it('queries by id AND domainId (workspace-scoped)', async () => {
    const report = { id: 'sr-10', domainId: DOMAIN_ID, score: 90, riskLevel: 'LOW' };
    const mockFindFirst = vi.fn().mockResolvedValue(report);

    const result = await ScanService.getById(
      { scanReport: { findFirst: mockFindFirst } } as never,
      DOMAIN_ID,
      'sr-10',
    );

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { id: 'sr-10', domainId: DOMAIN_ID },
    });
    expect(result?.id).toBe('sr-10');
  });

  it('returns null when report does not exist', async () => {
    const mockFindFirst = vi.fn().mockResolvedValue(null);

    const result = await ScanService.getById(
      { scanReport: { findFirst: mockFindFirst } } as never,
      DOMAIN_ID,
      'nonexistent',
    );

    expect(result).toBeNull();
  });
});

describe('ScanService.getLatestForDomain', () => {
  it('queries by domainId with descending createdAt and take 1', async () => {
    const report = { id: 'sr-latest', score: 95, riskLevel: 'LOW' };
    const mockFindFirst = vi.fn().mockResolvedValue(report);

    const result = await ScanService.getLatestForDomain(
      { scanReport: { findFirst: mockFindFirst } } as never,
      DOMAIN_ID,
    );

    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { domainId: DOMAIN_ID },
      orderBy: { createdAt: 'desc' },
    });
    expect(result?.id).toBe('sr-latest');
  });

  it('returns null when no reports exist', async () => {
    const mockFindFirst = vi.fn().mockResolvedValue(null);

    const result = await ScanService.getLatestForDomain(
      { scanReport: { findFirst: mockFindFirst } } as never,
      DOMAIN_ID,
    );

    expect(result).toBeNull();
  });
});
