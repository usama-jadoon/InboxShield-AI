import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockDoH } from '../__mocks__/doh.client';
import { MxScanner } from './mx.scanner';

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

describe('MxScanner', () => {
  const scanner = new MxScanner();

  beforeEach(() => {
    dohClient.instance = createMockDoH();
  });

  const mx = (data: string) => ({ type: 'MX' as const, name: 'example.com', data });

  it('PASS and returns MX routes sorted by priority', async () => {
    dohClient.instance!.setAnswers([
      mx('10 mail.example.com'),
      mx('5 mail2.example.com'),
    ]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.scoreWeight).toBe(0);
    expect(result.flags).toEqual([]);
    expect(result.rawData).toEqual([
      { priority: 5, exchange: 'mail2.example.com' },
      { priority: 10, exchange: 'mail.example.com' },
    ]);
  });

  it('FAIL with MISSING_MX when no records exist', async () => {
    dohClient.instance!.setAnswers([]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toEqual(['MISSING_MX']);
    expect(result.rawData).toEqual([]);
  });

  it('FAIL with NULL_MX when the first record is a null MX (.)', async () => {
    dohClient.instance!.setAnswers([mx('.')]);
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toEqual(['NULL_MX']);
  });

  it('FAIL with MISSING_MX and no throw when the DoH query fails', async () => {
    dohClient.instance!.setError(new Error('DoH Timeout'));
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toEqual(['MISSING_MX']);
    expect(result.rawData).toBeNull();
  });
});
