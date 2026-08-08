import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EngineOrchestrator } from './orchestrator';
import { BaseScanner, ScannerResult } from './types';

// ---------------------------------------------------------------------------
// Test doubles — deterministic fake scanners with fixed outcomes.
// ---------------------------------------------------------------------------

function fakeScanner(id: string, result: Partial<ScannerResult>): BaseScanner {
  return {
    id,
    description: `Fake scanner ${id}`,
    execute: vi.fn(async (): Promise<ScannerResult> => ({
      scannerId: id,
      passed: true,
      scoreWeight: 0,
      rawData: null,
      flags: [],
      ...result,
    })),
  };
}

/** Scanner that always rejects, exercising the safeExecute fault path. */
function throwingScanner(id: string): BaseScanner {
  return {
    id,
    description: `Throwing scanner ${id}`,
    execute: vi.fn(async (): Promise<ScannerResult> => {
      throw new Error('boom');
    }),
  };
}

describe('EngineOrchestrator', () => {
  let orchestrator: EngineOrchestrator;

  beforeEach(() => {
    orchestrator = new EngineOrchestrator();
  });

  // --- Registration ---

  it('registers scanners and reports them all in the EngineReport', async () => {
    const dns = fakeScanner('network:dns:a_record', { rawData: ['93.184.216.34'] });
    const spf = fakeScanner('auth:spf', { rawData: 'v=spf1 -all' });

    orchestrator.registerScanner(dns);
    orchestrator.registerScanner(spf);

    const report = await orchestrator.analyzeDomain('example.com');

    expect(report.domain).toBe('example.com');
    expect(Object.keys(report.scannerResults)).toEqual([
      'network:dns:a_record',
      'auth:spf',
    ]);
    expect(report.scannerResults['auth:spf'].rawData).toBe('v=spf1 -all');
    expect(report.timestamp).toBeDefined();
  });

  it('throws when a scanner ID is registered twice', () => {
    orchestrator.registerScanner(fakeScanner('auth:spf', {}));

    expect(() => orchestrator.registerScanner(fakeScanner('auth:spf', {}))).toThrow(
      'already registered',
    );
  });

  // --- Fault isolation ---

  it('does not crash when a scanner throws; marks it with SCANNER_FAULT', async () => {
    const good = fakeScanner('network:dns:a_record', {});
    const bad = throwingScanner('auth:spf');

    orchestrator.registerScanner(good);
    orchestrator.registerScanner(bad);

    const report = await orchestrator.analyzeDomain('example.com');

    expect(report.scannerResults['auth:spf'].flags).toEqual(['SCANNER_FAULT']);
    expect(report.scannerResults['auth:spf'].error).toContain('boom');
    expect(report.scannerResults['auth:spf'].scoreWeight).toBe(0);
    // The good scanner still produced a real result.
    expect(report.scannerResults['network:dns:a_record'].passed).toBe(true);
    // SCANNER_FAULT carries passed:false but scoreWeight 0, so the current
    // implementation does not penalize the global score for a fault.
    expect(report.globalScore).toBe(100);
  });

  // --- Scoring ---

  it('computes globalScore as 100 minus the sum of failed weights', async () => {
    const pass = fakeScanner('auth:spf', {});
    const fail20 = fakeScanner('auth:dmarc', { passed: false, scoreWeight: 40 });
    const fail50 = fakeScanner('network:blacklist:domain', {
      passed: false,
      scoreWeight: 50,
    });

    [pass, fail20, fail50].forEach((s) => orchestrator.registerScanner(s));

    const report = await orchestrator.analyzeDomain('example.com');
    expect(report.globalScore).toBe(10);
  });

  it('floors the globalScore at zero', async () => {
    const heavy = fakeScanner('auth:dmarc', { passed: false, scoreWeight: 60 });
    const heavier = fakeScanner('network:blacklist:domain', {
      passed: false,
      scoreWeight: 50,
    });

    [heavy, heavier].forEach((s) => orchestrator.registerScanner(s));

    const report = await orchestrator.analyzeDomain('example.com');
    expect(report.globalScore).toBe(0);
  });

  // --- Risk levels ---

  it('maps risk levels to score thresholds (LOW ≥90, MEDIUM ≥70, HIGH ≥40, CRITICAL <40)', async () => {
    const mk = (weight: number) =>
      fakeScanner(`s:${weight}`, { passed: false, scoreWeight: weight });

    const run = async (weights: number[]) => {
      const o = new EngineOrchestrator();
      weights.forEach((w) => o.registerScanner(mk(w)));
      return (await o.analyzeDomain('example.com')).riskLevel;
    };

    expect(await run([])).toBe('LOW');
    expect(await run([10])).toBe('LOW'); // 90
    expect(await run([30])).toBe('MEDIUM'); // 70
    expect(await run([60])).toBe('HIGH'); // 40
    expect(await run([70])).toBe('CRITICAL'); // 30
  });

  // --- Empty orchestrator ---

  it('reports a perfect score with no scanners registered', async () => {
    const report = await orchestrator.analyzeDomain('example.com');

    expect(report.globalScore).toBe(100);
    expect(report.riskLevel).toBe('LOW');
    expect(report.scannerResults).toEqual({});
  });
});
