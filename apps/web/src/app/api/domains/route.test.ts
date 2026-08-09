/**
 * @file V1-02: GET + POST /api/domains route wiring tests (AC-02).
 *
 * Uses the real DomainService + WorkspaceService (spread from the actual
 * @inboxshield/db module) with a hand-crafted PrismaClient mock, so the
 * tests exercise the route → service → mock-db contract end-to-end.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks --------------------------------------------------------

const SESSION_TOKEN = 'tok-route';
const WORKSPACE_ID = 'ws-route';
const WORKSPACE = { id: WORKSPACE_ID, name: 'W' };
// ISO strings match the wire format produced by NextResponse.json() (JSON serialization)
const DOMAIN_OBJ = { id: 'd1', domainName: 'example.com', workspaceId: WORKSPACE_ID, createdAt: '2026-08-09T03:03:06.536Z', updatedAt: '2026-08-09T03:03:06.536Z' };

// Hoisted mocks for the @inboxshield/db module
const { mockPrisma, cookieNameMock } = vi.hoisted(() => ({
  mockPrisma: {
    domain: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    session: { findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
  },
  cookieNameMock: vi.fn(() => 'next-auth.session-token'),
}));

// Spread the REAL module so DomainService / WorkspaceService / DomainError
// remain intact; only `prisma` is overridden.
vi.mock('@inboxshield/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@inboxshield/db')>();
  return { ...actual, prisma: mockPrisma };
});

vi.mock('@/lib/session', () => ({
  sessionCookieName: cookieNameMock,
}));

import { GET, POST } from './route';

// --- Helpers ------------------------------------------------------

function withCookie(body?: string, cookie = SESSION_TOKEN) {
  const req = new NextRequest('http://localhost:3000/api/domains', {
    method: 'GET',
    headers: cookie ? { cookie: `next-auth.session-token=${cookie}` } : undefined,
  });
  if (body !== undefined) {
    // NextRequest is immutable; reconstruct with body for POST
    return new NextRequest('http://localhost:3000/api/domains', {
      method: 'POST',
      headers: { cookie: `next-auth.session-token=${cookie}`, 'content-type': 'application/json' },
      body,
    });
  }
  return req;
}

function stubWorkspaceResolution() {
  mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
  mockPrisma.workspaceMember.findFirst.mockResolvedValue({ workspace: WORKSPACE });
}

// --- Tests --------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  cookieNameMock.mockReturnValue('next-auth.session-token');
});

describe('GET /api/domains', () => {
  it('returns 403 when no workspace is assigned', async () => {
    const req = withCookie();
    mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);

    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns 403 when the cookie is missing (empty token)', async () => {
    const req = new NextRequest('http://localhost:3000/api/domains');

    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns 200 with the workspace domains', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findMany.mockResolvedValue([DOMAIN_OBJ]);

    const res = await GET(withCookie());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [DOMAIN_OBJ] });
  });

  it('returns 500 on an unexpected DB error', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findMany.mockRejectedValue(new Error('boom'));

    const res = await GET(withCookie());

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to list domains');
  });
});

describe('POST /api/domains', () => {
  it('returns 403 when no workspace is assigned', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);

    const res = await POST(withCookie(JSON.stringify({ domain: 'example.com' }), SESSION_TOKEN));

    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid JSON body', async () => {
    stubWorkspaceResolution();
    const badReq = new NextRequest('http://localhost:3000/api/domains', {
      method: 'POST',
      headers: { cookie: `next-auth.session-token=${SESSION_TOKEN}`, 'content-type': 'application/json' },
      body: 'not-json{{{',
    });

    const res = await POST(badReq);

    expect(res.status).toBe(400);
  });

  it('returns 400 when domain is missing', async () => {
    stubWorkspaceResolution();

    const res = await POST(withCookie(JSON.stringify({}), SESSION_TOKEN));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Domain is required');
  });

  it('returns 400 when domain is an IP address', async () => {
    stubWorkspaceResolution();

    const res = await POST(withCookie(JSON.stringify({ domain: '1.2.3.4' }), SESSION_TOKEN));

    expect(res.status).toBe(400);
  });

  it('returns 201 when domain is created', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findUnique.mockResolvedValue(null);
    mockPrisma.domain.create.mockResolvedValue(DOMAIN_OBJ);

    const res = await POST(withCookie(JSON.stringify({ domain: 'example.com' }), SESSION_TOKEN));

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: DOMAIN_OBJ });
  });

  it('returns 409 on duplicate domain', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findUnique.mockResolvedValue(DOMAIN_OBJ);

    const res = await POST(withCookie(JSON.stringify({ domain: 'example.com' }), SESSION_TOKEN));

    expect(res.status).toBe(409);
  });

  it('returns 500 on unexpected error (no message leak)', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findUnique.mockRejectedValue(new Error('internal'));

    const res = await POST(withCookie(JSON.stringify({ domain: 'example.com' }), SESSION_TOKEN));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to create domain');
    expect(JSON.stringify(body)).not.toContain('internal');
  });
});
