/**
 * @file V1-04: GET /api/domains/:id/scans route wiring tests (AC-03).
 *
 * Uses a hand-crafted Prisma mock (no live DB) to verify the workspace-scoped
 * scan history contract: auth → workspace → domain ownership → ScanService.listByDomain.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Hoisted mocks ------------------------------------------------

const WORKSPACE_ID = 'ws-scans';
const DOMAIN_ID = 'dom-scans';

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

function buildReq(domainId: string, extraQS = '') {
  const qs = extraQS ? `?${extraQS}` : '';
  return new NextRequest(`http://localhost:3000/api/domains/${domainId}/scans${qs}`, {
    headers: { cookie: 'next-auth.session-token=tok' },
  });
}

function stubWorkspaceAndDomain() {
  mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
  mockPrisma.workspaceMember.findFirst.mockResolvedValue({ workspace: { id: WORKSPACE_ID } });
  mockPrisma.domain.findFirst.mockResolvedValue({ id: DOMAIN_ID, domainName: 'example.com', workspaceId: WORKSPACE_ID });
}

const SCAN_REPORTS = [
  { id: 'sr-1', score: 95, riskLevel: 'LOW', createdAt: '2026-08-09T01:00:00Z' },
  { id: 'sr-2', score: 80, riskLevel: 'MEDIUM', createdAt: '2026-08-09T00:00:00Z' },
];

// --- Tests --------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  cookieNameMock.mockReturnValue('next-auth.session-token');
  mockPrisma.scanReport.findMany.mockResolvedValue(SCAN_REPORTS);
});

describe('GET /api/domains/:id/scans', () => {
  it('returns 401 when session cookie is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/domains/dom-scans/scans');
    const res = await GET(req, { params: Promise.resolve({ id: DOMAIN_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when no workspace is assigned', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);
    const res = await GET(buildReq(DOMAIN_ID), { params: Promise.resolve({ id: DOMAIN_ID }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when domain is not in the workspace', async () => {
    stubWorkspaceAndDomain();
    mockPrisma.domain.findFirst.mockResolvedValue(null);
    const res = await GET(buildReq(DOMAIN_ID), { params: Promise.resolve({ id: DOMAIN_ID }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Domain not found in this workspace');
  });

  it('returns 200 with scan reports ordered by date descending', async () => {
    stubWorkspaceAndDomain();
    const res = await GET(buildReq(DOMAIN_ID), { params: Promise.resolve({ id: DOMAIN_ID }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe('sr-1');
    expect(body.data[1].id).toBe('sr-2');
  });

  it('passes the correct default limit (10) to ScanService', async () => {
    stubWorkspaceAndDomain();
    await GET(buildReq(DOMAIN_ID), { params: Promise.resolve({ id: DOMAIN_ID }) });
    expect(mockPrisma.scanReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });

  it('applies custom limit from query param', async () => {
    stubWorkspaceAndDomain();
    const res = await GET(buildReq(DOMAIN_ID, 'limit=5'), { params: Promise.resolve({ id: DOMAIN_ID }) });
    expect(res.status).toBe(200);
    expect(mockPrisma.scanReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it('caps limit at MAX_LIMIT (20) when query param is larger', async () => {
    stubWorkspaceAndDomain();
    await GET(buildReq(DOMAIN_ID, 'limit=100'), { params: Promise.resolve({ id: DOMAIN_ID }) });
    expect(mockPrisma.scanReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20 }),
    );
  });

  it('ignores invalid limit and uses default', async () => {
    stubWorkspaceAndDomain();
    await GET(buildReq(DOMAIN_ID, 'limit=abc'), { params: Promise.resolve({ id: DOMAIN_ID }) });
    expect(mockPrisma.scanReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
  });
});
