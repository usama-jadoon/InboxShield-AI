/**
 * @file V1-10: GET /api/export/pdf route wiring tests.
 *
 * Auth → workspace → domain ownership → report resolution (by scanId or
 * latest) → PDF generation. DB and the PDF renderer are mocked here; the
 * real `%PDF-` rendering is verified in src/lib/export/pdf.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Hoisted mocks ------------------------------------------------

const WORKSPACE_ID = 'ws-export';
const DOMAIN_ID = 'dom-export';

const { mockPrisma, cookieNameMock, mockGenerateReportPdf } = vi.hoisted(() => ({
  mockPrisma: {
    domain: { findFirst: vi.fn() },
    session: { findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
    scanReport: { findFirst: vi.fn() },
  },
  cookieNameMock: vi.fn(() => 'next-auth.session-token'),
  mockGenerateReportPdf: vi.fn(),
}));

vi.mock('@inboxshield/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@inboxshield/db')>();
  return { ...actual, prisma: mockPrisma };
});

vi.mock('@/lib/session', () => ({ sessionCookieName: cookieNameMock }));

vi.mock('@/lib/export/pdf', () => ({
  generateReportPdf: mockGenerateReportPdf,
}));

import { GET } from './route';

// --- Helpers ------------------------------------------------------

function buildReq(extraQS = '') {
  const qs = extraQS ? `?${extraQS}` : '';
  return new NextRequest(`http://localhost:3000/api/export/pdf${qs}`, {
    headers: { cookie: 'next-auth.session-token=tok' },
  });
}

function stubWorkspaceAndDomain() {
  mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
  mockPrisma.workspaceMember.findFirst.mockResolvedValue({ workspace: { id: WORKSPACE_ID } });
  mockPrisma.domain.findFirst.mockResolvedValue({ id: DOMAIN_ID, domainName: 'example.com', workspaceId: WORKSPACE_ID });
}

const SCAN_ROW = {
  id: 'sr-9',
  domainId: DOMAIN_ID,
  score: 92,
  riskLevel: 'LOW',
  reportModel: {
    metadata: { domain: 'example.com', generatedAt: '2026-08-10T00:00:00Z', version: '1.0.0' },
    executiveSummary: { score: 92, riskLevel: 'LOW', statusText: 'Optimal', riskColor: 'emerald' },
    authentication: [],
    infrastructure: [],
    recommendations: [],
    technicalAppendix: {},
  },
  createdAt: new Date('2026-08-10T00:00:00.000Z'),
};

// --- Tests --------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  cookieNameMock.mockReturnValue('next-auth.session-token');
  mockGenerateReportPdf.mockResolvedValue(Buffer.from('%PDF-1.4 ...', 'latin1'));
});

describe('GET /api/export/pdf', () => {
  it('returns 401 when session cookie is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/export/pdf');
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

  it('fetches latest report and returns application/pdf attachment', async () => {
    stubWorkspaceAndDomain();
    mockPrisma.scanReport.findFirst.mockResolvedValue(SCAN_ROW);
    const res = await GET(buildReq('domainId=dom-export'));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Content-Disposition')).toContain(
      'attachment; filename="inboxshield-example.com-report.pdf"',
    );
    expect(mockGenerateReportPdf).toHaveBeenCalledOnce();
    // Passed the stored ReportModel snapshot.
    const passed = mockGenerateReportPdf.mock.calls[0][0];
    expect(passed.metadata.domain).toBe('example.com');
    expect(passed.executiveSummary.score).toBe(92);
  });

  it('fetches a specific scan by scanId when provided', async () => {
    stubWorkspaceAndDomain();
    mockPrisma.scanReport.findFirst.mockResolvedValue(SCAN_ROW);
    await GET(buildReq('domainId=dom-export&scanId=sr-9'));
    expect(mockPrisma.scanReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'sr-9', domainId: DOMAIN_ID } }),
    );
  });

  it('returns 404 when no scan report exists for the domain', async () => {
    stubWorkspaceAndDomain();
    mockPrisma.scanReport.findFirst.mockResolvedValue(null);
    const res = await GET(buildReq('domainId=dom-export'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Scan report not found for this domain');
  });

  it('returns 500 when PDF rendering fails', async () => {
    stubWorkspaceAndDomain();
    mockPrisma.scanReport.findFirst.mockResolvedValue(SCAN_ROW);
    mockGenerateReportPdf.mockRejectedValue(new Error('render boom'));
    const res = await GET(buildReq('domainId=dom-export'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal Server Error');
  });
});
