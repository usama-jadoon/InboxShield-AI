/**
 * @file V1-10: GET /api/export/csv route wiring tests.
 *
 * Auth → workspace → domain ownership → CSV serialization. DB is mocked;
 * the CSV serializer is the real implementation (unit-tested separately).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Hoisted mocks ------------------------------------------------

const WORKSPACE_ID = 'ws-export';
const DOMAIN_ID = 'dom-export';

const { mockPrisma, cookieNameMock } = vi.hoisted(() => ({
  mockPrisma: {
    domain: { findFirst: vi.fn() },
    session: { findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
    scanReport: { findMany: vi.fn() },
  },
  cookieNameMock: vi.fn(() => 'next-auth.session-token'),
}));

vi.mock('@inboxshield/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@inboxshield/db')>();
  return { ...actual, prisma: mockPrisma };
});

vi.mock('@/lib/session', () => ({ sessionCookieName: cookieNameMock }));

import { GET } from './route';

// --- Helpers ------------------------------------------------------

function buildReq(extraQS = '') {
  const qs = extraQS ? `?${extraQS}` : '';
  return new NextRequest(`http://localhost:3000/api/export/csv${qs}`, {
    headers: { cookie: 'next-auth.session-token=tok' },
  });
}

function stubWorkspaceAndDomain() {
  mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
  mockPrisma.workspaceMember.findFirst.mockResolvedValue({ workspace: { id: WORKSPACE_ID } });
  mockPrisma.domain.findFirst.mockResolvedValue({ id: DOMAIN_ID, domainName: 'example.com', workspaceId: WORKSPACE_ID });
}

const SCAN_REPORTS = [
  {
    id: 'sr-1',
    domainId: DOMAIN_ID,
    score: 95,
    riskLevel: 'LOW',
    reportModel: {},
    createdAt: new Date('2026-08-09T01:00:00.000Z'),
  },
  {
    id: 'sr-2',
    domainId: DOMAIN_ID,
    score: 80,
    riskLevel: 'MEDIUM',
    reportModel: {},
    createdAt: new Date('2026-08-09T00:00:00.000Z'),
  },
];

// --- Tests --------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  cookieNameMock.mockReturnValue('next-auth.session-token');
  mockPrisma.scanReport.findMany.mockResolvedValue(SCAN_REPORTS);
});

describe('GET /api/export/csv', () => {
  it('returns 401 when session cookie is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/export/csv');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 when no workspace is assigned', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);
    const res = await GET(buildReq('domainId=dom-export'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when domain is not in the workspace', async () => {
    stubWorkspaceAndDomain();
    mockPrisma.domain.findFirst.mockResolvedValue(null);
    const res = await GET(buildReq('domainId=dom-export'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Domain not found in this workspace');
  });

  it('returns text/csv attachment with serialized rows', async () => {
    stubWorkspaceAndDomain();
    const res = await GET(buildReq('domainId=dom-export'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('Content-Disposition')).toContain(
      'attachment; filename="inboxshield-example.com-history.csv"',
    );
    const text = await res.text();
    expect(text).toContain('scanId,score,riskLevel,createdAt');
    expect(text).toContain('sr-1,95,LOW,2026-08-09T01:00:00.000Z');
    expect(text).toContain('sr-2,80,MEDIUM,2026-08-09T00:00:00.000Z');
  });

  it('passes default limit (50) to listByDomain', async () => {
    stubWorkspaceAndDomain();
    await GET(buildReq('domainId=dom-export'));
    expect(mockPrisma.scanReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('honors custom limit and caps at 100', async () => {
    stubWorkspaceAndDomain();
    await GET(buildReq('domainId=dom-export&limit=25'));
    expect(mockPrisma.scanReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
    await GET(buildReq('domainId=dom-export&limit=999'));
    expect(mockPrisma.scanReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });
});
