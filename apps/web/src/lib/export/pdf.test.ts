/**
 * @file V1-10: PDF export tests.
 *
 * The anti-fabrication contract (CLAUDE.md §7) demands real evidence: we
 * assert the generated buffer starts with genuine `%PDF-` magic bytes.
 */
import { describe, it, expect } from 'vitest';
import { generateReportPdf, ReportPdfDocument } from './pdf';
import type { ReportModel } from '@inboxshield/engine';

function makeReport(): ReportModel {
  return {
    metadata: {
      domain: 'example.com',
      generatedAt: '2026-08-10T00:00:00.000Z',
      version: '1.0.0',
    },
    executiveSummary: {
      score: 92,
      riskLevel: 'LOW',
      statusText: 'Optimal',
      riskColor: 'emerald',
    },
    authentication: [
      {
        id: 'auth:spf',
        title: 'SPF',
        passed: true,
        statusLabel: 'PASS',
        statusColor: 'emerald',
        description: 'SPF record found',
        technicalDetail: 'v=spf1 -all',
      },
    ],
    infrastructure: [
      {
        id: 'network:dns:a_record',
        title: 'A Record',
        passed: true,
        statusLabel: 'PASS',
        statusColor: 'emerald',
        description: 'A record resolves',
        technicalDetail: '93.184.216.34',
      },
    ],
    recommendations: [
      {
        issue: 'SPF',
        recommendation: 'Keep the SPF record valid',
        technicalDetails: 'v=spf1 -all',
      },
    ],
    technicalAppendix: {},
  };
}

describe('generateReportPdf', () => {
  it('produces a real PDF buffer with %PDF- magic bytes', async () => {
    const buf = await generateReportPdf(makeReport());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  }, 20_000);

  it('embeds the report domain in the document title', () => {
    const el = ReportPdfDocument({ report: makeReport() });
    expect(el).toBeTruthy();
    // The Document element carries the title prop.
    expect((el.props as { title?: string }).title).toContain('example.com');
  });
});

describe('ReportPdfDocument', () => {
  it('is a renderable React element (non-null type)', () => {
    const el = ReportPdfDocument({ report: makeReport() });
    expect(el).toBeTruthy();
    expect(el.type).toBeDefined();
  });
});
