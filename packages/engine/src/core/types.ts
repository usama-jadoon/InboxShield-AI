/**
 * Defines the standard output shape for any standalone scanner plugin.
 */
export interface ScannerResult {
  scannerId: string;
  /**
   * Verdict: true ONLY for a confirmed PASS; false ONLY for a confirmed FAIL;
   * null when there is no definitive verdict (ERROR / UNSUPPORTED / DISABLED /
   * PARTIAL). Never fabricate a boolean for an unperformed check.
   */
  passed: boolean | null;
  /** Internal confidence or risk weight calculation per scanner (0-100) */
  scoreWeight: number;
  /**
   * The raw technical data fetched (e.g. DNS string, RBL array).
   * @immutable Once created by a scanner, rawData must not be mutated. Copy before modifying.
   */
  rawData: unknown;
  /** A human readable error string if passed = false */
  error?: string;
  /** Standardized flags useful for the AI layer downstream */
  flags: string[];
}

/**
 * The strict contract every scanner module must implement.
 */
export interface BaseScanner {
  readonly id: string;
  readonly description: string;
  /**
   * Executes the scan against the target domain.
   * @param domain The target e.g. "example.com"
   */
  execute(domain: string): Promise<ScannerResult>;
}

/**
 * The normalized payload emitted by the Core Engine after running all scanners.
 */
export interface EngineReport {
  domain: string;
  timestamp: string;
  globalScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scannerResults: Record<string, ScannerResult>;
}
