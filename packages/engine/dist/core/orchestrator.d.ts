import { BaseScanner, EngineReport } from './types';
export declare class EngineOrchestrator {
    private scanners;
    constructor();
    /**
     * Registers a new scanner plugin dynamically at runtime.
     */
    registerScanner(scanner: BaseScanner): void;
    /**
     * Evaluates all registered scanners against the domain concurrently.
     */
    analyzeDomain(domain: string): Promise<EngineReport>;
    /**
     * A resilient execution wrapper to ensure one failing plugin
     * doesn't crash the entire orchestration.
     */
    private safeExecute;
    /**
     * Deterministic scoring logic digesting bounded score weights.
     */
    private calculateGlobalScore;
}
