import { describe, expect, it } from 'vitest';
import { HeuristicAiProvider } from './heuristic.provider';
import { EngineReport, ScannerResult } from '../core/types';

// ---------------------------------------------------------------------------
// Helpers — build an EngineReport with a controllable set of scanner results.
// ---------------------------------------------------------------------------

function result(
  scannerId: string,
  flags: string[] = [],
  passed = true,
): ScannerResult {
  return {
    scannerId,
    passed,
    scoreWeight: passed ? 0 : 20,
    rawData: null,
    flags,
  };
}

function report(results: Record<string, ScannerResult>): EngineReport {
  return {
    domain: 'example.com',
    timestamp: '2026-08-08T00:00:00.000Z',
    globalScore: 100,
    riskLevel: 'LOW',
    scannerResults: results,
  };
}

const provider = new HeuristicAiProvider();

describe('HeuristicAiProvider', () => {
  it('has a stable provider name', () => {
    expect(provider.providerName).toBe('LocalHeuristicEngine');
  });

  it('returns no recommendations for a fully healthy report', async () => {
    const recs = await provider.analyze(report({}));
    expect(recs).toEqual([]);
  });

  it('recommends fixing a missing SPF record', async () => {
    const recs = await provider.analyze(
      report({ 'auth:spf': result('auth:spf', ['MISSING_SPF'], false) }),
    );

    expect(recs).toHaveLength(1);
    expect(recs[0].issue).toBe('Missing SPF Record');
    expect(recs[0].technicalDetails).toContain('v=spf1');
  });

  it('recommends merging duplicate SPF records', async () => {
    const recs = await provider.analyze(
      report({ 'auth:spf': result('auth:spf', ['DUPLICATE_SPF'], false) }),
    );

    expect(recs[0].issue).toBe('Duplicate SPF Records');
    expect(recs[0].recommendation).toContain('multiple SPF records');
  });

  it('recommends publishing DMARC when missing', async () => {
    const recs = await provider.analyze(
      report({ 'auth:dmarc': result('auth:dmarc', ['MISSING_DMARC'], false) }),
    );

    expect(recs[0].issue).toBe('No DMARC published');
    expect(recs[0].technicalDetails).toContain('_dmarc');
  });

  it('recommends tightening a p=none DMARC policy', async () => {
    const recs = await provider.analyze(
      report({
        'auth:dmarc': result('auth:dmarc', ['MONITORING_ONLY_DMARC'], false),
      }),
    );

    expect(recs[0].issue).toBe('Weak DMARC Policy (p=none)');
    expect(recs[0].recommendation).toContain('monitoring mode');
  });

  it('recommends strengthening a weak DKIM key', async () => {
    const recs = await provider.analyze(
      report({
        'auth:dkim': result('auth:dkim', ['DKIM_WEAK_KEY_SIZE_1024_OR_LESS'], false),
      }),
    );

    expect(recs[0].issue).toBe('Weak DKIM Key Size');
    expect(recs[0].recommendation).toContain('2048-bit');
  });

  it('recommends renewing an expired TLS certificate', async () => {
    const recs = await provider.analyze(
      report({
        'network:smtp:tls': result('network:smtp:tls', ['CERT_EXPIRED'], false),
      }),
    );

    expect(recs[0].issue).toBe('Mail Server TLS Expired');
    expect(recs[0].recommendation).toContain('expired');
  });

  it('recommends disabling weak TLS protocols', async () => {
    const recs = await provider.analyze(
      report({
        'network:smtp:tls': result('network:smtp:tls', ['WEAK_TLS'], false),
      }),
    );

    expect(recs[0].issue).toBe('Insecure Protocol Upgrades');
    expect(recs[0].technicalDetails).toContain('TLSv1.2');
  });

  it('recommends RBL delisting when the domain is blacklisted', async () => {
    const recs = await provider.analyze(
      report({
        'network:blacklist:domain': result(
          'network:blacklist:domain',
          ['DOMAIN_BLACKLISTED'],
          false,
        ),
      }),
    );

    expect(recs[0].issue).toBe('Domain Actively Blacklisted');
    expect(recs[0].recommendation).toContain('Real-Time Blackhole List');
    expect(recs[0].technicalDetails).toContain('removal request');
  });

  it('aggregates recommendations across multiple failing scanners', async () => {
    const recs = await provider.analyze(
      report({
        'auth:spf': result('auth:spf', ['MISSING_SPF'], false),
        'auth:dmarc': result('auth:dmarc', ['MISSING_DMARC'], false),
        'network:smtp:tls': result('network:smtp:tls', ['WEAK_TLS'], false),
      }),
    );

    expect(recs).toHaveLength(3);
    expect(recs.map((r) => r.issue)).toEqual([
      'Missing SPF Record',
      'No DMARC published',
      'Insecure Protocol Upgrades',
    ]);
  });

  it('ignores flags it does not have a rule for', async () => {
    const recs = await provider.analyze(
      report({
        'auth:spf': result('auth:spf', ['UNKNOWN_FLAG'], false),
      }),
    );

    expect(recs).toEqual([]);
  });
});
