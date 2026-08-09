import { describe, expect, it } from 'vitest';
import { PresentationSection, ReportModel } from './types';
import { ReportBuilder } from './builder';
import { EngineReport, ScannerResult } from '../core/types';
import { AiRecommendation } from '../ai/provider';

// ---------------------------------------------------------------------------
// Runtime shape guard — mirrors the ReportModel compile-time contract so the
// evidence snapshot is enforceable at runtime.
// ---------------------------------------------------------------------------

function isPresentationSection(value: unknown): value is PresentationSection {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.title === 'string' &&
    typeof v.passed === 'boolean' &&
    ['PASS', 'FAIL', 'WARNING', 'SKIPPED'].includes(v.statusLabel as string) &&
    ['emerald', 'rose', 'amber', 'neutral'].includes(v.statusColor as string) &&
    typeof v.description === 'string' &&
    typeof v.technicalDetail === 'string'
  );
}

function isReportModel(value: unknown): value is ReportModel {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const v = value as Record<string, unknown>;
  const meta = v.metadata as Record<string, unknown> | undefined;
  const exec = v.executiveSummary as Record<string, unknown> | undefined;
  return (
    !!meta &&
    typeof meta.domain === 'string' &&
    typeof meta.generatedAt === 'string' &&
    meta.version === '1.0.0' &&
    !!exec &&
    typeof exec.score === 'number' &&
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(exec.riskLevel as string) &&
    typeof exec.statusText === 'string' &&
    ['emerald', 'amber', 'rose'].includes(exec.riskColor as string) &&
    Array.isArray(v.authentication) &&
    v.authentication.every((s) => isPresentationSection(s)) &&
    Array.isArray(v.infrastructure) &&
    v.infrastructure.every((s) => isPresentationSection(s)) &&
    Array.isArray(v.recommendations) &&
    v.recommendations.every((r) => {
      const rec = r as Record<string, unknown>;
      return (
        typeof rec.issue === 'string' && typeof rec.recommendation === 'string'
      );
    }) &&
    typeof v.technicalAppendix === 'object' &&
    v.technicalAppendix !== null
  );
}

describe('ReportModel evidence contract', () => {
  const validModel: ReportModel = {
    metadata: {
      domain: 'example.com',
      generatedAt: '2026-08-08T00:00:00.000Z',
      version: '1.0.0',
    },
    executiveSummary: {
      score: 100,
      riskLevel: 'LOW',
      statusText: 'Optimal Configuration',
      riskColor: 'emerald',
    },
    authentication: [],
    infrastructure: [],
    recommendations: [],
    technicalAppendix: {},
  };

  it('accepts a fully-formed ReportModel with version 1.0.0', () => {
    expect(isReportModel(validModel)).toBe(true);
  });

  it('fails the contract when metadata.version is missing', () => {
    const missing = {
      ...validModel,
      metadata: { ...validModel.metadata, version: undefined },
    };
    expect(isReportModel(missing)).toBe(false);
  });

  it('rejects when metadata.domain is missing', () => {
    const missing = {
      ...validModel,
      metadata: { ...validModel.metadata, domain: undefined },
    };
    expect(isReportModel(missing)).toBe(false);
  });

  it('rejects when executiveSummary.score is not a number', () => {
    const bad = {
      ...validModel,
      executiveSummary: { ...validModel.executiveSummary, score: '100' },
    };
    expect(isReportModel(bad)).toBe(false);
  });

  it('rejects when riskLevel is outside the enum', () => {
    const bad = {
      ...validModel,
      executiveSummary: { ...validModel.executiveSummary, riskLevel: 'EXTREME' },
    };
    expect(isReportModel(bad)).toBe(false);
  });

  it('rejects when authentication is not an array of PresentationSection', () => {
    const bad = { ...validModel, authentication: [{ id: 1 }] };
    expect(isReportModel(bad)).toBe(false);
  });

  it('rejects when a recommendation lacks the required fields', () => {
    const bad = { ...validModel, recommendations: [{ issue: 'x' }] };
    expect(isReportModel(bad)).toBe(false);
  });

  it('ReportBuilder.build emits a contract-conforming, versioned ReportModel', () => {
    const engine: EngineReport = {
      domain: 'example.com',
      timestamp: '2026-08-08T00:00:00.000Z',
      globalScore: 100,
      riskLevel: 'LOW',
      scannerResults: {} as Record<string, ScannerResult>,
    };
    const recs: AiRecommendation[] = [{ issue: 'x', recommendation: 'y' }];

    const model = ReportBuilder.build(engine, recs);

    expect(isReportModel(model)).toBe(true);
    expect(model.metadata.version).toBe('1.0.0');
  });
});
