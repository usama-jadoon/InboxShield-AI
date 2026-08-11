/**
 * @file V1-02: DELETE /api/domains/:id route wiring tests (AC-02).
 *
 * Exercises workspace-scoped deletion via the real DomainService with a
 * mocked PrismaClient.  Verifies 204 success, 404 on NOT_FOUND, 403 when
 * no workspace is resolved, and 500 on unexpected errors.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// --- Mocks --------------------------------------------------------

const SESSION_TOKEN = 'tok-delete';
const WORKSPACE_ID = 'ws-delete';
const WORKSPACE = { id: WORKSPACE_ID, name: 'W' };
const DOMAIN_ID = 'dom-delete';

const { mockPrisma, cookieNameMock } = vi.hoisted(() => ({
  mockPrisma: {
    domain: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    session: { findUnique: vi.fn() },
    workspaceMember: { findFirst: vi.fn() },
  },
  cookieNameMock: vi.fn(() => 'next-auth.session-token'),
}));

vi.mock('@inboxshield/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@inboxshield/db')>();
  return { ...actual, prisma: mockPrisma };
});

vi.mock('@/lib/session', () => ({
  sessionCookieName: cookieNameMock,
}));

import { DELETE } from './route';

function buildReq() {
  return new NextRequest(`http://localhost:3000/api/domains/${DOMAIN_ID}`, {
    method: 'DELETE',
    headers: { cookie: `next-auth.session-token=${SESSION_TOKEN}` },
  });
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

describe('DELETE /api/domains/:id', () => {
  it('returns 204 when the domain is deleted successfully', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findFirst.mockResolvedValue({ id: DOMAIN_ID, workspaceId: WORKSPACE_ID });
    mockPrisma.domain.delete.mockResolvedValue(undefined);

    const res = await DELETE(buildReq(), {
      params: Promise.resolve({ id: DOMAIN_ID }),
    });

    expect(res.status).toBe(204);
    expect(mockPrisma.domain.findFirst).toHaveBeenCalledWith({
      where: { id: DOMAIN_ID, workspaceId: WORKSPACE_ID },
    });
  });

  it('returns 404 when the domain is not found in the workspace', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findFirst.mockResolvedValue(null);

    const res = await DELETE(buildReq(), {
      params: Promise.resolve({ id: 'missing' }),
    });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Domain not found');
  });

  it('returns 403 when no workspace is assigned', async () => {
    mockPrisma.session.findUnique.mockResolvedValue({ userId: 'u1' });
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);

    const res = await DELETE(buildReq(), {
      params: Promise.resolve({ id: DOMAIN_ID }),
    });

    expect(res.status).toBe(403);
  });

  it('returns 401 when the cookie is missing', async () => {
    const noCookieReq = new NextRequest(`http://localhost:3000/api/domains/${DOMAIN_ID}`, {
      method: 'DELETE',
    });

    const res = await DELETE(noCookieReq, {
      params: Promise.resolve({ id: DOMAIN_ID }),
    });

    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected DB errors (no message leak)', async () => {
    stubWorkspaceResolution();
    mockPrisma.domain.findFirst.mockRejectedValue(new Error('unexpected'));

    const res = await DELETE(buildReq(), {
      params: Promise.resolve({ id: DOMAIN_ID }),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to delete domain');
    expect(JSON.stringify(body)).not.toContain('unexpected');
  });
});
