import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlacklistScanner } from './blacklist.scanner';

// Hoisted mutable config that the mocked resolve reads from.
const { blacklistState } = vi.hoisted(() => ({
  blacklistState: {
    /** DBL names the mock resolver will consider the domain "listed" on. */
    listed: [] as string[],
    /** If non-null the mock resolver throws this error for every query. */
    otherError: null as Error | null,
  },
}));

vi.mock('node:dns/promises', () => ({
  resolve: vi.fn(async (query: string): Promise<string[]> => {
    if (blacklistState.otherError) throw blacklistState.otherError;
    const matched = blacklistState.listed.find((dbl) => query.endsWith(`.${dbl}`));
    if (matched) return ['127.0.0.2'];
    throw Object.assign(new Error('queryA ENOTFOUND'), { code: 'ENOTFOUND' });
  }),
}));

describe('BlacklistScanner', () => {
  const scanner = new BlacklistScanner();

  beforeEach(() => {
    blacklistState.listed = [];
    blacklistState.otherError = null;
  });

  it('PASS when the domain is not listed on any DBL', async () => {
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.scoreWeight).toBe(0);
    expect(result.rawData).toEqual([]);
    expect(result.flags).toEqual([]);
  });

  it('FAIL with DOMAIN_BLACKLISTED when listed on one DBL', async () => {
    blacklistState.listed = ['dbl.spamhaus.org'];
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(50);
    expect(result.flags).toEqual(['DOMAIN_BLACKLISTED']);
    expect(result.rawData).toEqual(['dbl.spamhaus.org']);
    expect(result.error).toContain('dbl.spamhaus.org');
  });

  it('FAIL with all listing sources reported when listed on multiple DBLs', async () => {
    blacklistState.listed = ['dbl.spamhaus.org', 'multi.surbl.org'];
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.rawData).toEqual(['dbl.spamhaus.org', 'multi.surbl.org']);
  });

  /**
   * Current behavior: non-ENOTFOUND/ENODATA network errors (e.g. ECONNREFUSED)
   * are silently swallowed, so the scanner cannot confirm a listing and returns
   * passed: true. This test documents the existing behavior — a later unit may
   * improve error propagation.
   */
  it('does not fabricate a FAIL on transient RBL network errors', async () => {
    blacklistState.otherError = Object.assign(new Error('ECONNREFUSED'), {
      code: 'ECONNREFUSED',
    });
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.rawData).toEqual([]);
  });
});
