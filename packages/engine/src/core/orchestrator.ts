import { BaseScanner, EngineReport, ScannerResult } from './types';

export class EngineOrchestrator {
  private scanners: Map<string, BaseScanner>;

  constructor() {
    this.scanners = new Map();
  }

  /**
   * Registers a new scanner plugin dynamically at runtime.
   */
  public registerScanner(scanner: BaseScanner): void {
    if (this.scanners.has(scanner.id)) {
      throw new Error(`Scanner with ID ${scanner.id} is already registered.`);
    }
    this.scanners.set(scanner.id, scanner);
  }

  /**
   * Evaluates all registered scanners against the domain concurrently.
   */
  public async analyzeDomain(domain: string): Promise<EngineReport> {
    const t0 = Date.now();
    const tasks = Array.from(this.scanners.values()).map(scanner => 
      this.safeExecute(scanner, domain)
    );

    const rawResults = await Promise.all(tasks);
    
    // Normalize mapping by scanner ID
    const scannerResults: Record<string, ScannerResult> = {};
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
  private async safeExecute(scanner: BaseScanner, domain: string): Promise<ScannerResult> {
    try {
      return await scanner.execute(domain);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        scannerId: scanner.id,
        passed: null, // scanner fault is an ERROR — no definitive PASS/FAIL verdict
        scoreWeight: 0,
        rawData: null,
        error: `Scanner ${scanner.id} encountered a fatal execution error: ${message}`,
        flags: ['SCANNER_FAULT']
      };
    }
  }

  /**
   * Deterministic scoring logic digesting bounded score weights.
   */
  private calculateGlobalScore(results: ScannerResult[]): { globalScore: number, riskLevel: EngineReport['riskLevel'] } {
    let score = 100;
    
    // Each scanner returns a scoreWeight indicative of its penalty boundary.
    // Only a confirmed FAIL (passed === false) reduces the score — a null
    // verdict (ERROR/UNSUPPORTED/DISABLED/PARTIAL) is NOT a failure.
    results.forEach(res => {
      if (res.passed === false) {
        score -= res.scoreWeight;
      }
    });

    score = Math.max(0, score); // Floor at 0

    let riskLevel: EngineReport['riskLevel'] = 'LOW';
    if (score < 40) riskLevel = 'CRITICAL';
    else if (score < 70) riskLevel = 'HIGH';
    else if (score < 90) riskLevel = 'MEDIUM';

    return { globalScore: score, riskLevel };
  }
}
