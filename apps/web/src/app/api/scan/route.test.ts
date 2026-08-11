/**
 * @file V1-03: POST /api/scan persistence wiring tests (AC-03).
 *
 * Exercises the full scan route: session auth → workspace resolution →
 * domain lookup → engine scan → AI recommendations → ReportBuilder →
 * ScanService.persist → response with scan ID.
 *
 * Uses mocked PrismaClient, mocked engine/scanners (no real DNS), and a
 * hand-crafted ReportBuilder output to verify the DB write contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Hoisted mocks ------------------------------------------------

const SESSION_TOKEN = 'tok-scan';
const WORKSPACE_ID = 'ws-scan';
const DOMAIN_ID = 'dom-scan';
const WORKSPACE = { id: WORKSPACE_ID, name: 'W' };
const DOMAIN_OBJ = { id: DOMAIN_ID, domainName: 'example.com', workspaceId: WORKSPACE_ID };

const { mockPrisma, cookieNameMock, orchestratorMock } = vi.hoisted(() => ({
  mockPrisma: {
    domain: { findFirst: vi.fn() },
    session: { findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
    scanReport: { create: vi.fn() },
  },
  cookieNameMock: vi.fn(() => 'next-auth.session-token'),
  // Shared orchestrator instance so tests can reach the SAME object the route
  // holds (the route calls `new EngineOrchestrator()` at module load).
  orchestratorMock: {
    registerScanner: vi.fn(),
    analyzeDomain: vi.fn(),
  },
}));

// Persist real services; override only `prisma`.
vi.mock('@inboxshield/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@inboxshield/db')>();
  return { ...actual, prisma: mockPrisma };
});

vi.mock('@/lib/session', () => ({
  sessionCookieName: cookieNameMock,
}));

// Engine scanners and orchestrator are mocked — no real DNS lookups.
vi.mock('@inboxshield/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@inboxshield/engine')>();

  // Stub HeuristicAiProvider.analyze to return empty recommendations.
  const HeuristicAiProviderStub = vi.fn().mockImplementation(() => ({
    providerName: 'heuristic-stub',
    analyze: vi.fn().mockResolvedValue([]),
  }));

  return {
    ...actual,
    // Every `new EngineOrchestrator()` (including the route's module-level one)
    // returns the SAME shared object, so tests can stub analyzeDomain directly.
    EngineOrchestrator: vi.fn().mockImplementation(() => orchestratorMock),
    HeuristicAiProvider: HeuristicAiProviderStub,
  };
});

// Import after mocks are set up.
import { POST } from './route';

// --- Helpers ------------------------------------------------------

function buildReq(domain?: string) {
  const headers: Record<string, string> = {
    cookie: `next-auth.session-token=${SESSION_TOKEN}`,
    'content-type': 'application/json',
  };
  const body = domain !== undefined ? JSON.stringify({ domain }) : undefined;
  return new NextRequest('http://localhost:3000/api/scan', {
    method: 'POST',
    headers,
    body,
  });
}

function stubWorkspaceResolution() {
  mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
  mockPrisma.workspaceMember.findFirst.mockResolvedValue({ workspace: WORKSPACE });
}

const CREATED_SCAN = {
  id: 'sr-1',
  domainId: DOMAIN_ID,
  score: 95,
  riskLevel: 'LOW',
  reportModel: { executiveSummary: { score: 95, riskLevel: 'LOW' } },
  createdAt: '2026-08-09T00:00:00.000Z',
};

// Deterministic engine output matching the EngineReport contract.
const STUB_REPORT = {
  domain: 'example.com',
  timestamp: '2026-08-09T00:00:00Z',
  globalScore: 95,
  riskLevel: 'LOW',
  scannerResults: {},
};

// --- Tests --------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  cookieNameMock.mockReturnValue('next-auth.session-token');
  mockPrisma.scanReport.create.mockResolvedValue(CREATED_SCAN);
  orchestratorMock.analyzeDomain.mockResolvedValue(STUB_REPORT);
});

describe('POST /api/scan', () => {
  it('returns 401 when session cookie is missing', async () => {
    const req = new NextRequest('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ domain: 'example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 404 when no workspace is assigned', async () => {
    stubWorkspaceResolution();
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);

    const res = await POST(buildReq('example.com'));
    expect(res.status).toBe(404);
  });

  it('returns 404 when domain is not registered in the workspace', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findFirst.mockResolvedValue(null);

    const res = await POST(buildReq('example.com'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Domain is not registered in this workspace');
  });

  it('returns 200 with persisted scan record on success', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findFirst.mockResolvedValue(DOMAIN_OBJ);

    const res = await POST(buildReq('example.com'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data.scanId).toBe('sr-1');
    expect(body.data.score).toBe(95);
    expect(body.data.riskLevel).toBe('LOW');
    expect(body.data.report.executiveSummary.score).toBe(95);

    // Verify the DB write was called with correct args.
    expect(mockPrisma.scanReport.create).toHaveBeenCalledWith({
      data: {
        domainId: DOMAIN_ID,
        score: 95,
        riskLevel: 'LOW',
        reportModel: expect.objectContaining({
          executiveSummary: expect.objectContaining({ score: 95 }),
        }),
      },
    });
  });

  it('returns 400 for invalid JSON body', async () => {
    stubWorkspaceResolution();
    const badReq = new NextRequest('http://localhost:3000/api/scan', {
      method: 'POST',
      headers: {
        cookie: `next-auth.session-token=${SESSION_TOKEN}`,
        'content-type': 'application/json',
      },
      body: 'not-json{{{',
    });

    const res = await POST(badReq);
    expect(res.status).toBe(400);
  });

  it('returns 400 when domain is missing', async () => {
    stubWorkspaceResolution();
    const res = await POST(buildReq());
    expect(res.status).toBe(400);
  });

  it('returns 400 when domain is an IP address (SSRF defence)', async () => {
    stubWorkspaceResolution();
    const res = await POST(buildReq('192.168.1.1'));
    expect(res.status).toBe(400);
  });

  it('returns 500 when scan throws (no message leak)', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findFirst.mockResolvedValue(DOMAIN_OBJ);

    // Override the shared orchestrator mock to throw.
    orchestratorMock.analyzeDomain.mockRejectedValue(new Error('DNS timeout'));

    const res = await POST(buildReq('example.com'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Scan failed');
    expect(JSON.stringify(body)).not.toContain('DNS timeout');
  });
});
