import { describe, expect, it } from 'vitest';
import { ReportBuilder } from './builder';
import { EngineReport, ScannerResult } from '../core/types';
import { AiRecommendation } from '../ai/provider';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function result(
  scannerId: string,
  overrides: Partial<ScannerResult> = {},
): ScannerResult {
  return {
    scannerId,
    passed: true,
    scoreWeight: 0,
    rawData: null,
    flags: [],
    ...overrides,
  };
}

function report(
  results: Record<string, ScannerResult>,
  riskLevel: EngineReport['riskLevel'] = 'LOW',
  globalScore = 100,
): EngineReport {
  return {
    domain: 'example.com',
    timestamp: '2026-08-08T00:00:00.000Z',
    globalScore,
    riskLevel,
    scannerResults: results,
  };
}

function sectionById(model: ReturnType<typeof ReportBuilder.build>, id: string) {
  return [...model.authentication, ...model.infrastructure].find(
    (s) => s.id === id,
  );
}

describe('ReportBuilder', () => {
  it('builds a complete ReportModel with frozen metadata version', () => {
    const engine = report({
      'auth:spf': result('auth:spf', { rawData: 'v=spf1 -all' }),
    });
    const recs: AiRecommendation[] = [
      { issue: 'x', recommendation: 'y', technicalDetails: 'z' },
    ];

    const model = ReportBuilder.build(engine, recs);

    expect(model.metadata).toEqual({
      domain: 'example.com',
      generatedAt: '2026-08-08T00:00:00.000Z',
      version: '1.0.0',
    });
    expect(model.executiveSummary.score).toBe(100);
    expect(model.executiveSummary.riskLevel).toBe('LOW');
    expect(model.recommendations).toEqual(recs);
    expect(model.technicalAppendix).toBe(engine.scannerResults);
  });

  // --- Risk mapping ---

  it('maps LOW to "Optimal Configuration" / emerald', () => {
    const model = ReportBuilder.build(report({}, 'LOW', 95), []);
    expect(model.executiveSummary.statusText).toBe('Optimal Configuration');
    expect(model.executiveSummary.riskColor).toBe('emerald');
  });

  it('maps MEDIUM to "Action Recommended" / amber', () => {
    const model = ReportBuilder.build(report({}, 'MEDIUM', 80), []);
    expect(model.executiveSummary.statusText).toBe('Action Recommended');
    expect(model.executiveSummary.riskColor).toBe('amber');
  });

  it('maps HIGH to "Critical Vulnerabilities Detected" / rose', () => {
    const model = ReportBuilder.build(report({}, 'HIGH', 60), []);
    expect(model.executiveSummary.statusText).toBe(
      'Critical Vulnerabilities Detected',
    );
    expect(model.executiveSummary.riskColor).toBe('rose');
  });

  it('maps CRITICAL to "Active Deliverability Failure" / rose', () => {
    const model = ReportBuilder.build(report({}, 'CRITICAL', 20), []);
    expect(model.executiveSummary.statusText).toBe(
      'Active Deliverability Failure',
    );
    expect(model.executiveSummary.riskColor).toBe('rose');
  });

  // --- Presentation sections ---

  it('marks a section PASS with an evidence-based description', () => {
    const model = ReportBuilder.build(
      report({
        'auth:spf': result('auth:spf', { rawData: 'v=spf1 -all' }),
      }),
      [],
    );

    const spf = sectionById(model, 'auth:spf')!;
    expect(spf.statusLabel).toBe('PASS');
    expect(spf.statusColor).toBe('emerald');
    expect(spf.passed).toBe(true);
    expect(spf.description).toContain('v=spf1 -all');
    expect(spf.technicalDetail).toBe('No flags raised.');
  });

  it('marks a section FAIL using the scanner error text', () => {
    const model = ReportBuilder.build(
      report({
        'auth:dmarc': result('auth:dmarc', {
          passed: false,
          error: 'No DMARC TXT record found.',
          flags: ['MISSING_DMARC'],
        }),
      }),
      [],
    );

    const dmarc = sectionById(model, 'auth:dmarc')!;
    expect(dmarc.statusLabel).toBe('FAIL');
    expect(dmarc.statusColor).toBe('rose');
    expect(dmarc.passed).toBe(false);
    expect(dmarc.description).toBe('No DMARC TXT record found.');
    expect(dmarc.technicalDetail).toBe('Flags: MISSING_DMARC');
  });

  it('marks a section WARNING when a monitoring-style flag is present', () => {
    const model = ReportBuilder.build(
      report({
        'auth:dmarc': result('auth:dmarc', {
          passed: false,
          flags: ['MONITORING_ONLY_DMARC'],
        }),
      }),
      [],
    );

    const dmarc = sectionById(model, 'auth:dmarc')!;
    expect(dmarc.statusLabel).toBe('WARNING');
    expect(dmarc.statusColor).toBe('amber');
  });

  it('marks a section SKIPPED when the scanner result is absent', () => {
    const model = ReportBuilder.build(report({}), []);

    // Without a scanner result the id falls back to a title-derived slug.
    const dns = sectionById(model, 'dns-resolution-(a/aaaa)')!;
    expect(dns).toBeDefined();
    expect(dns.statusLabel).toBe('SKIPPED');
    expect(dns.statusColor).toBe('neutral');
    expect(dns.description).toBe('Scan was not executed.');
  });

  it('marks a section SKIPPED when the SKIPPED_NO_MX flag is present', () => {
    const model = ReportBuilder.build(
      report({
        'network:smtp:tls': result('network:smtp:tls', {
          passed: false,
          flags: ['SKIPPED_NO_MX'],
        }),
      }),
      [],
    );

    const tls = sectionById(model, 'network:smtp:tls')!;
    expect(tls.statusLabel).toBe('SKIPPED');
    expect(tls.statusColor).toBe('neutral');
  });

  // --- Section inventory ---

  it('includes all authentication and infrastructure sections', () => {
    const model = ReportBuilder.build(report({}), []);

    const ids = [...model.authentication, ...model.infrastructure].map(
      (s) => s.id,
    );
    // With no scanner results the sections use title-derived slugs.
    expect(ids).toEqual([
      'sender-policy-framework-(spf)',
      'domainkeys-identified-mail-(dkim)',
      'dmarc-enforcement',
      'dns-resolution-(a/aaaa)',
      'mail-exchange-(mx)',
      'smtp-&-tls-security',
      'domain-blacklists-(rbl/dbl)',
    ]);
  });

  it('extracts MX count from the raw routes', () => {
    const model = ReportBuilder.build(
      report({
        'network:mx': result('network:mx', {
          rawData: [
            { priority: 5, exchange: 'mail1.example.com' },
            { priority: 10, exchange: 'mail2.example.com' },
          ],
        }),
      }),
      [],
    );

    const mx = sectionById(model, 'network:mx')!;
    expect(mx.description).toContain('2 active MX routes defined.');
  });
});
