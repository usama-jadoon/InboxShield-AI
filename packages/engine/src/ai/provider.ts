import { EngineReport } from '../core/types';

export interface AiRecommendation {
  issue: string;
  recommendation: string;
  technicalDetails?: string;
}

/**
 * Interface guaranteeing any LLM provider (OpenAI, Anthropic, local heuristic)
 * can be plugged in to parse engine telemetry.
 */
export interface AiProvider {
  readonly providerName: string;
  analyze(report: EngineReport): Promise<AiRecommendation[]>;
}
