import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDoH } from '../__mocks__/doh.client';
import { SpfScanner } from './spf.scanner';

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

describe('SpfScanner', () => {
  const scanner = new SpfScanner();

  beforeEach(() => {
    dohClient.instance = createMockDoH();
  });

  /** Shorthand: a TXT answer at the target domain. */
  const txt = (data: string) => ({ type: 'TXT' as const, name: 'example.com', data });

  it('PASS with a hard-fail (-all) policy', async () => {
    dohClient.instance!.setAnswers([txt('v=spf1 include:_spf.google.com -all')]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toEqual([]);
    expect(result.rawData).toBe('v=spf1 include:_spf.google.com -all');
  });

  it('PASS with a soft-fail (~all) policy', async () => {
    dohClient.instance!.setAnswers([txt('v=spf1 include:_spf.google.com ~all')]);
    const result = await scanner.execute('example.com');
    expect(result.passed).toBe(true);
  });

  it('PASS with a neutral (?all) policy', async () => {
    dohClient.instance!.setAnswers([txt('v=spf1 include:_spf.google.com ?all')]);
    const result = await scanner.execute('example.com');
    expect(result.passed).toBe(true);
  });

  it('FAIL with MISSING_SPF when no SPF record exists', async () => {
    dohClient.instance!.setAnswers([]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(30);
    expect(result.flags).toEqual(['MISSING_SPF']);
    expect(result.error).toContain('No SPF record found');
    expect(result.rawData).toEqual([]);
  });

  it('FAIL with WEAK_SPF_POLICY when the record has no termination policy', async () => {
    dohClient.instance!.setAnswers([txt('v=spf1 include:_spf.google.com')]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toEqual(['WEAK_SPF_POLICY']);
    expect(result.error).toContain('termination policy');
  });

  it('FAIL with DUPLICATE_SPF when multiple SPF records are published', async () => {
    dohClient.instance!.setAnswers([
      txt('v=spf1 include:_spf.google.com -all'),
      txt('v=spf1 include:sendgrid.net -all'),
    ]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(30);
    expect(result.flags).toEqual(['DUPLICATE_SPF']);
    expect(result.rawData).toHaveLength(2);
  });

  it('FAIL with MISSING_SPF and no throw when the DoH query fails', async () => {
    dohClient.instance!.setError(new Error('DoH Timeout'));
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(30);
    expect(result.flags).toEqual(['MISSING_SPF']);
    expect(result.rawData).toBeNull();
  });
});
