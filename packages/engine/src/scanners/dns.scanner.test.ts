import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDoH } from '../__mocks__/doh.client';
import { DnsScanner } from './dns.scanner';

// vi.mock is hoisted above imports — reference a vi.hoisted container so the
// factory closure stays valid before module evaluation.
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

describe('DnsScanner', () => {
  const scanner = new DnsScanner();

  beforeEach(() => {
    dohClient.instance = createMockDoH();
  });

  it('PASS when the domain has an A record', async () => {
    dohClient.instance!.setAnswers([
      { type: 'A', name: 'example.com', data: '93.184.216.34' },
    ]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toEqual([]);
    expect(result.error).toBeUndefined();
    expect(result.rawData).toEqual(['93.184.216.34']);
  });

  it('FAIL with NO_RESOLUTION when no A records exist', async () => {
    dohClient.instance!.setAnswers([]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toEqual(['NO_RESOLUTION']);
    expect(result.error).toContain('No A records found');
    expect(result.rawData).toEqual([]);
  });

  it('FAIL with DNS_ERROR and no throw when the DoH query itself fails', async () => {
    dohClient.instance!.setError(new Error('DoH Timeout'));
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.flags).toEqual(['DNS_ERROR']);
    expect(result.error).toContain('DoH Timeout');
    expect(result.rawData).toBeNull();
  });

  it('only considers answers matching the queried domain', async () => {
    dohClient.instance!.setAnswers([
      { type: 'A', name: 'other.example.com', data: '10.0.0.1' },
      { type: 'A', name: 'example.com', data: '93.184.216.34' },
    ]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.rawData).toEqual(['93.184.216.34']);
  });
});
