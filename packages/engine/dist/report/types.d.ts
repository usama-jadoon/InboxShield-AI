import { AiRecommendation } from '../ai/provider';
export interface PresentationSection {
    id: string;
    title: string;
    passed: boolean;
    statusLabel: 'PASS' | 'FAIL' | 'WARNING' | 'SKIPPED';
    statusColor: 'emerald' | 'rose' | 'amber' | 'neutral';
    description: string;
    technicalDetail: string;
}
export interface ReportModel {
    metadata: {
        domain: string;
        generatedAt: string;
        version: string;
    };
    executiveSummary: {
        score: number;
        riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        statusText: string;
        riskColor: 'emerald' | 'amber' | 'rose';
    };
    authentication: PresentationSection[];
    infrastructure: PresentationSection[];
    recommendations: AiRecommendation[];
    technicalAppendix: Record<string, any>;
}
