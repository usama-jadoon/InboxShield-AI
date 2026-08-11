/**
 * @file V1-10: CSV export serialization tests.
 */
import { describe, it, expect } from 'vitest';
import { csvEscape, scanHistoryToCsv } from './csv';
import type { ScanReport } from '@prisma/client';

function makeReport(overrides: Partial<ScanReport> = {}): ScanReport {
  return {
    id: 'sr-1',
    domainId: 'dom-1',
    score: 92,
    riskLevel: 'LOW',
    reportModel: {},
    createdAt: new Date('2026-08-09T00:00:00.000Z'),
    ...overrides,
  } as ScanReport;
}

describe('csvEscape', () => {
  it('passes plain values through unchanged', () => {
    expect(csvEscape('abc')).toBe('abc');
    expect(csvEscape('LOW')).toBe('LOW');
    expect(csvEscape('92')).toBe('92');
  });

  it('quotes values containing a comma', () => {
    expect(csvEscape('a,b')).toBe('"a,b"');
  });

  it('quotes values containing a double-quote and doubles it', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes values containing newline or carriage return', () => {
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"');
    expect(csvEscape('line1\r\nline2')).toBe('"line1\r\nline2"');
  });
});

describe('scanHistoryToCsv', () => {
  it('emits header row only for empty history', () => {
    expect(scanHistoryToCsv([])).toBe('scanId,score,riskLevel,createdAt');
  });

  it('emits header + one data row with CRLF line endings', () => {
    const csv = scanHistoryToCsv([makeReport()]);
    expect(csv).toBe(
      'scanId,score,riskLevel,createdAt\r\n' +
        'sr-1,92,LOW,2026-08-09T00:00:00.000Z',
    );
  });

  it('preserves caller row order (most-recent-first)', () => {
    const csv = scanHistoryToCsv([
      makeReport({ id: 'sr-2', createdAt: new Date('2026-08-09T01:00:00.000Z') }),
      makeReport({ id: 'sr-1', createdAt: new Date('2026-08-09T00:00:00.000Z') }),
    ]);
    const lines = csv.split('\r\n');
    expect(lines[1]).toContain('sr-2');
    expect(lines[2]).toContain('sr-1');
  });

  it('escapes riskLevel text that contains a comma', () => {
    const csv = scanHistoryToCsv([makeReport({ riskLevel: 'MEDIUM, URGENT' })]);
    expect(csv).toContain('"MEDIUM, URGENT"');
  });
});
