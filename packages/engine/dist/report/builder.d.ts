import { EngineReport } from '../core/types';
import { AiRecommendation } from '../ai/provider';
import { ReportModel } from './types';
export declare class ReportBuilder {
    /**
     * Transforms raw engine and AI output into a strictly formatted, presentation-ready ReportModel.
     * This guarantees the Dashboard and PDF exporters share exact formatting logic, status labels, and color designations.
     */
    static build(report: EngineReport, recommendations: AiRecommendation[]): ReportModel;
    private static mapResultToSection;
    private static buildAuthSections;
    private static buildInfraSections;
}
