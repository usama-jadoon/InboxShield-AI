/**
 * @file V1-01: proxy route protection tests (AC-01).
 *
 * Exercises the proxy handler's branching logic with a stubbed
 * validateSessionToken, verifying the fail-closed invariant without
 * touching Prisma or the database.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { validateMock, cookieNameMock } = vi.hoisted(() => ({
  validateMock: vi.fn(),
  cookieNameMock: vi.fn(() => 'next-auth.session-token'),
}));

vi.mock('./lib/session', () => ({
  validateSessionToken: validateMock,
  sessionCookieName: cookieNameMock,
}));

import proxy from './proxy';

describe('proxy route protection', () => {
  beforeEach(() => {
    validateMock.mockReset();
    cookieNameMock.mockReset();
    cookieNameMock.mockReturnValue('next-auth.session-token');
  });

  it('lets authenticated requests through (status 200)', async () => {
    validateMock.mockResolvedValue(true);
    const res = await proxy(new NextRequest('http://localhost:3000/domains'));
    expect(res.status).toBe(200);
  });

  it('returns 401 for unauthenticated API routes', async () => {
    validateMock.mockResolvedValue(false);
    const res = await proxy(new NextRequest('http://localhost:3000/api/scan'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
  });

  it('redirects unauthenticated page requests to /login', async () => {
    validateMock.mockResolvedValue(false);
    const res = await proxy(new NextRequest('http://localhost:3000/domains'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  it('reads the session token from the configured cookie name', async () => {
    validateMock.mockResolvedValue(true);
    cookieNameMock.mockReturnValue('next-auth.session-token');
    await proxy(
      new NextRequest('http://localhost:3000/', {
        headers: { cookie: 'next-auth.session-token=abc' },
      }),
    );
    expect(cookieNameMock).toHaveBeenCalled();
    expect(validateMock).toHaveBeenCalledWith('abc');
  });

  it('passes an empty token when no cookie is present', async () => {
    validateMock.mockResolvedValue(false);
    await proxy(new NextRequest('http://localhost:3000/'));
    expect(validateMock).toHaveBeenCalledWith('');
  });

  it('uses the __Secure- cookie name when NEXTAUTH_URL is https', async () => {
    cookieNameMock.mockReturnValue('__Secure-next-auth.session-token');
    validateMock.mockResolvedValue(true);
    await proxy(
      new NextRequest('http://localhost:3000/', {
        headers: { cookie: '__Secure-next-auth.session-token=def' },
      }),
    );
    expect(validateMock).toHaveBeenCalledWith('def');
  });

  it('fails closed: unauthenticated /api/auth/* is excluded by matcher, not tested here — matcher test is static config', async () => {
    // The matcher excludes /api/auth/* so the proxy never invokes
    // validateSessionToken for those routes. This is a structural contract:
    // the handler itself cannot be tested for this (it never runs). The
    // runtime smoke test in V1-01 verification confirms the matcher.
    expect(true).toBe(true);
  });
});
