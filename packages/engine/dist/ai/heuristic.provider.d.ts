import { AiProvider, AiRecommendation } from './provider';
import { EngineReport } from '../core/types';
export declare class HeuristicAiProvider implements AiProvider {
    readonly providerName = "LocalHeuristicEngine";
    analyze(report: EngineReport): Promise<AiRecommendation[]>;
}
