export class EngineOrchestrator {
    scanners;
    constructor() {
        this.scanners = new Map();
    }
    /**
     * Registers a new scanner plugin dynamically at runtime.
     */
    registerScanner(scanner) {
        if (this.scanners.has(scanner.id)) {
            throw new Error(`Scanner with ID ${scanner.id} is already registered.`);
        }
        this.scanners.set(scanner.id, scanner);
    }
    /**
     * Evaluates all registered scanners against the domain concurrently.
     */
    async analyzeDomain(domain) {
        const t0 = Date.now();
        const tasks = Array.from(this.scanners.values()).map(scanner => this.safeExecute(scanner, domain));
        const rawResults = await Promise.all(tasks);
        // Normalize mapping by scanner ID
        const scannerResults = {};
        rawResults.forEach(res => {
            scannerResults[res.scannerId] = res;
        });
        // Score synthesis
        const { globalScore, riskLevel } = this.calculateGlobalScore(rawResults);
        return {
            domain,
            timestamp: new Date().toISOString(),
            globalScore,
            riskLevel,
            scannerResults
        };
    }
    /**
     * A resilient execution wrapper to ensure one failing plugin
     * doesn't crash the entire orchestration.
     */
    async safeExecute(scanner, domain) {
        try {
            return await scanner.execute(domain);
        }
        catch (err) {
            return {
                scannerId: scanner.id,
                passed: false,
                scoreWeight: 0,
                rawData: null,
                error: `Scanner ${scanner.id} encountered a fatal execution error: ${err.message}`,
                flags: ['SCANNER_FAULT']
            };
        }
    }
    /**
     * Deterministic scoring logic digesting bounded score weights.
     */
    calculateGlobalScore(results) {
        let score = 100;
        // Each scanner returns a scoreWeight indicative of its penalty boundary
        results.forEach(res => {
            if (!res.passed) {
                score -= res.scoreWeight;
            }
        });
        score = Math.max(0, score); // Floor at 0
        let riskLevel = 'LOW';
        if (score < 40)
            riskLevel = 'CRITICAL';
        else if (score < 70)
            riskLevel = 'HIGH';
        else if (score < 90)
            riskLevel = 'MEDIUM';
        return { globalScore: score, riskLevel };
    }
}
