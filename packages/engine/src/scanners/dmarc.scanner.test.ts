import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDoH } from '../__mocks__/doh.client';
import { DmarcScanner } from './dmarc.scanner';

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

describe('DmarcScanner', () => {
  const scanner = new DmarcScanner();

  beforeEach(() => {
    dohClient.instance = createMockDoH();
  });

  const dmarc = (data: string) => ({
    type: 'TXT' as const,
    name: '_dmarc.example.com',
    data,
  });

  it('PASS with an enforcement policy (p=reject)', async () => {
    dohClient.instance!.setAnswers([
      dmarc('v=DMARC1; p=reject; rua=mailto:dmarc@example.com'),
    ]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.scoreWeight).toBe(0);
    expect(result.flags).toEqual([]);
  });

  it('PASS with p=quarantine', async () => {
    dohClient.instance!.setAnswers([dmarc('v=DMARC1; p=quarantine')]);
    const result = await scanner.execute('example.com');
    expect(result.passed).toBe(true);
  });

  it('FAIL with MONITORING_ONLY_DMARC when p=none', async () => {
    dohClient.instance!.setAnswers([
      dmarc('v=DMARC1; p=none; rua=mailto:dmarc@example.com'),
    ]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(15);
    expect(result.flags).toEqual(['MONITORING_ONLY_DMARC']);
  });

  it('FAIL with MISSING_DMARC when no record exists', async () => {
    dohClient.instance!.setAnswers([]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(40);
    expect(result.flags).toEqual(['MISSING_DMARC']);
    expect(result.rawData).toBeNull();
  });

  it('FAIL with MALFORMED_DMARC when p= is absent', async () => {
    dohClient.instance!.setAnswers([
      dmarc('v=DMARC1; rua=mailto:dmarc@example.com'),
    ]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(40);
    expect(result.flags).toEqual(['MALFORMED_DMARC']);
  });

  it('FAIL with DUPLICATE_DMARC when multiple records are published', async () => {
    dohClient.instance!.setAnswers([
      dmarc('v=DMARC1; p=reject'),
      dmarc('v=DMARC1; p=quarantine'),
    ]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(40);
    expect(result.flags).toEqual(['DUPLICATE_DMARC']);
  });

  it('FAIL with MISSING_DMARC and no throw when the DoH query fails', async () => {
    dohClient.instance!.setError(new Error('DoH Timeout'));
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(40);
    expect(result.flags).toEqual(['MISSING_DMARC']);
    expect(result.rawData).toBeNull();
  });
});
