import { describe, expect, it } from 'vitest';
import { EngineReport, ScannerResult } from './types';

// ---------------------------------------------------------------------------
// Runtime shape guards — mirror the compile-time evidence contracts so the
// contract is enforceable at runtime (types are erased by tsc).
// ---------------------------------------------------------------------------

function isScannerResult(value: unknown): value is ScannerResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.scannerId === 'string' &&
    (typeof v.passed === 'boolean' || v.passed === null) &&
    typeof v.scoreWeight === 'number' &&
    'rawData' in v &&
    Array.isArray(v.flags) &&
    v.flags.every((flag) => typeof flag === 'string')
  );
}

function isEngineReport(value: unknown): value is EngineReport {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.domain === 'string' &&
    typeof v.timestamp === 'string' &&
    typeof v.globalScore === 'number' &&
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(v.riskLevel as string) &&
    typeof v.scannerResults === 'object' &&
    v.scannerResults !== null &&
    !Array.isArray(v.scannerResults) &&
    Object.values(v.scannerResults as Record<string, unknown>).every((r) =>
      isScannerResult(r),
    )
  );
}

describe('ScannerResult evidence contract', () => {
  it('accepts a PASS verdict (passed: true)', () => {
    const result: ScannerResult = {
      scannerId: 'auth:spf',
      passed: true,
      scoreWeight: 30,
      rawData: 'v=spf1 -all',
      flags: [],
    };
    expect(isScannerResult(result)).toBe(true);
  });

  it('accepts a FAIL verdict (passed: false)', () => {
    const result: ScannerResult = {
      scannerId: 'auth:spf',
      passed: false,
      scoreWeight: 30,
      rawData: null,
      flags: ['MISSING_SPF'],
    };
    expect(isScannerResult(result)).toBe(true);
  });

  it('accepts an ERROR/UNSUPPORTED verdict (passed: null)', () => {
    const result: ScannerResult = {
      scannerId: 'network:dnssec',
      passed: null,
      scoreWeight: 0,
      rawData: null,
      error: 'Not implemented.',
      flags: ['UNSUPPORTED'],
    };
    expect(isScannerResult(result)).toBe(true);
  });

  it('rejects a result with a missing scannerId', () => {
    expect(
      isScannerResult({ passed: true, scoreWeight: 0, rawData: null, flags: [] }),
    ).toBe(false);
  });

  it('rejects a result whose passed is neither boolean nor null', () => {
    expect(
      isScannerResult({
        scannerId: 'x',
        passed: 'yes',
        scoreWeight: 0,
        rawData: null,
        flags: [],
      }),
    ).toBe(false);
  });

  it('rejects a result with non-string flags', () => {
    expect(
      isScannerResult({
        scannerId: 'x',
        passed: null,
        scoreWeight: 0,
        rawData: null,
        flags: [1],
      }),
    ).toBe(false);
  });

  it('rejects a result with a missing rawData field', () => {
    expect(
      isScannerResult({
        scannerId: 'x',
        passed: null,
        scoreWeight: 0,
        flags: [],
      }),
    ).toBe(false);
  });
});

describe('EngineReport evidence contract', () => {
  it('accepts a well-formed report', () => {
    const report: EngineReport = {
      domain: 'example.com',
      timestamp: '2026-08-08T00:00:00.000Z',
      globalScore: 100,
      riskLevel: 'LOW',
      scannerResults: {
        'auth:spf': {
          scannerId: 'auth:spf',
          passed: true,
          scoreWeight: 0,
          rawData: null,
          flags: [],
        },
      },
    };
    expect(isEngineReport(report)).toBe(true);
  });

  it('rejects a report with an out-of-enum riskLevel', () => {
    expect(
      isEngineReport({
        domain: 'x',
        timestamp: 't',
        globalScore: 100,
        riskLevel: 'EXTREME',
        scannerResults: {},
      }),
    ).toBe(false);
  });

  it('rejects a report whose scannerResults value is not a valid ScannerResult', () => {
    expect(
      isEngineReport({
        domain: 'x',
        timestamp: 't',
        globalScore: 100,
        riskLevel: 'LOW',
        scannerResults: {
          'auth:spf': { passed: true },
        },
      }),
    ).toBe(false);
  });
});
