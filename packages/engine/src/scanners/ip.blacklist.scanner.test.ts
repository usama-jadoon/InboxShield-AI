import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IpBlacklistScanner } from './ip.blacklist.scanner';

// Mock node:dns/promises so no test performs a real network lookup.
const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));

vi.mock('node:dns/promises', () => ({
  resolve: resolveMock,
}));

describe('IpBlacklistScanner', () => {
  let scanner: IpBlacklistScanner;

  beforeEach(() => {
    scanner = new IpBlacklistScanner();
    resolveMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('has the canonical IP-RBL identity and description', () => {
    expect(scanner.id).toBe('network:blacklist:ip');
    expect(scanner.description).toContain('IP');
  });

  it('returns FAIL when the IP is listed on an RBL', async () => {
    // zen.spamhaus.org and bl.spamcop.net report the IP as listed (resolve to an A record);
    // b.barracudacentral.org reports clean (ENOTFOUND).
    resolveMock.mockImplementation(async (query: string) => {
      if (query.endsWith('.zen.spamhaus.org') || query.endsWith('.bl.spamcop.net')) {
        return ['127.0.0.2'];
      }
      throw Object.assign(new Error('queryA ENOTFOUND'), { code: 'ENOTFOUND' });
    });

    const result = await scanner.execute('1.2.3.4');

    expect(result.passed).toBe(false);
    expect(result.flags).toContain('IP_BLACKLISTED');
    expect(result.rawData).toEqual(expect.arrayContaining(['zen.spamhaus.org', 'bl.spamcop.net']));
    expect(result.scoreWeight).toBeGreaterThan(0);
  });

  it('returns PASS when the IP is clean on all RBLs (ENOTFOUND = not listed)', async () => {
    resolveMock.mockImplementation(async () => {
      throw Object.assign(new Error('queryA ENOTFOUND'), { code: 'ENOTFOUND' });
    });

    const result = await scanner.execute('5.6.7.8');

    expect(result.passed).toBe(true);
    expect(result.flags).toEqual([]);
    expect(result.scoreWeight).toBe(0);
  });

  it('degrades gracefully when an RBL lookup errors with a network failure (no throw)', async () => {
    resolveMock.mockImplementation(async () => {
      throw new Error('queryA ESERVFAIL');
    });

    // Must not throw; a network error on one RBL never yields a fabricated verdict.
    await expect(scanner.execute('9.9.9.9')).resolves.toBeDefined();
  });

  it('handles an invalid IP format without throwing', async () => {
    // Contains a dot (so it is treated as an IP-like input) but is not a 4-octet IPv4.
    const result = await scanner.execute('1.2.3');

    expect(result.passed).toBe(false);
    expect(result.flags).toContain('INVALID_IP');
    expect(result.error).toContain('Invalid IP address format');
  });
});
