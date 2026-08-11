import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  sessionCookieName,
  validateSessionToken,
  dbSessionLookup,
} from './session';

// Mock the db package so no test touches a real PrismaClient/PostgreSQL.
const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));
vi.mock('@inboxshield/db', () => ({
  prisma: { session: { findUnique: findUniqueMock } },
}));

describe('sessionCookieName', () => {
  const originalUrl = process.env.NEXTAUTH_URL;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXTAUTH_URL;
    else process.env.NEXTAUTH_URL = originalUrl;
  });

  it('uses the plain cookie name when NEXTAUTH_URL is unset', () => {
    delete process.env.NEXTAUTH_URL;
    expect(sessionCookieName()).toBe('next-auth.session-token');
  });

  it('uses the plain cookie name for http URLs', () => {
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    expect(sessionCookieName()).toBe('next-auth.session-token');
  });

  it('uses the secure cookie name for https URLs', () => {
    process.env.NEXTAUTH_URL = 'https://app.inboxshield.ai';
    expect(sessionCookieName()).toBe('__Secure-next-auth.session-token');
  });
});

describe('validateSessionToken', () => {
  it('returns false for an empty token without calling the lookup', async () => {
    const lookup = vi.fn();
    expect(await validateSessionToken('', lookup)).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('returns false when the lookup finds no session', async () => {
    expect(await validateSessionToken('abc', async () => null)).toBe(false);
  });

  it('returns true when the session expiry is in the future', async () => {
    const future = new Date(Date.now() + 3_600_000);
    expect(await validateSessionToken('abc', async () => ({ expires: future }))).toBe(true);
  });

  it('returns false when the session has expired', async () => {
    const past = new Date(Date.now() - 3_600_000);
    expect(await validateSessionToken('abc', async () => ({ expires: past }))).toBe(false);
  });

  it('fails closed (false) when the lookup throws', async () => {
    const boom = async (): Promise<never> => {
      throw new Error('database unreachable');
    };
    expect(await validateSessionToken('abc', boom)).toBe(false);
  });
});

describe('dbSessionLookup', () => {
  it('queries the session table by token and maps the row to { expires }', async () => {
    const row = {
      id: 's1',
      sessionToken: 'abc',
      userId: 'u1',
      expires: new Date('2027-01-01T00:00:00Z'),
    };
    findUniqueMock.mockResolvedValue(row);

    const result = await dbSessionLookup('abc');

    expect(findUniqueMock).toHaveBeenCalledWith({ where: { sessionToken: 'abc' } });
    expect(result).toEqual({ expires: row.expires });
  });

  it('returns null when no row matches', async () => {
    findUniqueMock.mockResolvedValue(null);
    expect(await dbSessionLookup('missing')).toBeNull();
  });
});
