import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDoH } from '../__mocks__/doh.client';
import { DkimScanner } from './dkim.scanner';

const { dohClient } = vi.hoisted(() => ({
  dohClient: { instance: null as ReturnType<typeof createMockDoH> | null },
}));

vi.mock('../utils/doh.client', () => ({
  DoHClient: {
    resolve: (domain: string, type: 'A' | 'TXT' | 'MX') =>
      dohClient.instance!.resolve(domain, type),
    query: (domain: string, type: string) =>
      dohClient.instance!.query(domain, type),
  },
}));

describe('DkimScanner', () => {
  const scanner = new DkimScanner();

  /**
   * p= values calibrated to the scanner's length-based key-strength heuristic:
   *   < 200   → DKIM_WEAK_KEY_SIZE_1024_OR_LESS
   *   200-379 → no size flag (default)
   *   ≥ 380   → DKIM_STRONG_KEY_SIZE_2048
   */
  const WEAK_KEY   = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A';
  const DEFAULT_KEY = 'MII'.padEnd(250, 'B');
  const STRONG_KEY  = 'MII'.padEnd(420, 'A');

  beforeEach(() => {
    dohClient.instance = createMockDoH();
  });

  const dkim = (selector: string, data: string) => ({
    type: 'TXT' as const,
    name: `${selector}._domainkey.example.com`,
    data,
  });

  it('PASS when a common selector publishes a valid DKIM key', async () => {
    dohClient.instance!.setAnswers([dkim('selector1', `v=DKIM1; k=rsa; p=${DEFAULT_KEY}`)]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.scoreWeight).toBe(0);
    expect(result.flags).toEqual([]);
    expect(result.rawData).toMatchObject({ selector: 'selector1', type: 'rsa' });
  });

  it('PASS but flags a weak (<=1024-bit class) key', async () => {
    dohClient.instance!.setAnswers([dkim('google', `v=DKIM1; k=rsa; p=${WEAK_KEY}`)]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.flags).toContain('DKIM_WEAK_KEY_SIZE_1024_OR_LESS');
  });

  it('PASS and flags a strong (2048-bit class) key', async () => {
    dohClient.instance!.setAnswers([dkim('default', `v=DKIM1; k=rsa; p=${STRONG_KEY}`)]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.flags).toContain('DKIM_STRONG_KEY_SIZE_2048');
  });

  it('FAIL with DKIM_MISSING_KEY when p= is empty', async () => {
    dohClient.instance!.setAnswers([dkim('mail', 'v=DKIM1; p=')]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toContain('DKIM_MISSING_KEY');
  });

  it('FAIL with DKIM_INVALID_VERSION when v= is not DKIM1', async () => {
    // Use a long key so the weak-flag path does not also trigger.
    dohClient.instance!.setAnswers([dkim('mail', `v=DKIM2; k=rsa; p=${DEFAULT_KEY}`)]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.flags).toContain('DKIM_INVALID_VERSION');
  });

  it('FAIL with DKIM_NOT_FOUND when no common selector publishes a key', async () => {
    dohClient.instance!.setAnswers([]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(0);
    expect(result.flags).toEqual(['DKIM_NOT_FOUND']);
    expect(result.rawData).toBeNull();
  });

  it('FAIL with a penalty weight when an exact knownSelector is missing', async () => {
    dohClient.instance!.setAnswers([]);
    const result = await scanner.execute('example.com', 'custom-selector');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toEqual(['DKIM_NOT_FOUND']);
    expect(result.error).toContain('custom-selector._domainkey.example.com');
  });
});
