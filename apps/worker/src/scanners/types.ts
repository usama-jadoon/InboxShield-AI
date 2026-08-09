export type ScanStatus = 'PASS' | 'FAIL' | 'ERROR' | 'UNSUPPORTED' | 'DISABLED' | 'PARTIAL';

/**
 * ScannerResult is the canonical contract for all worker scanners.
 *
 * Invariant: `passed` is `true` ONLY when `status === 'PASS'`,
 * `false` ONLY when `status === 'FAIL'`, and `null` for all other states
 * (ERROR, UNSUPPORTED, DISABLED, PARTIAL) — no definitive verdict exists,
 * so `passed` must never carry a fabricated boolean. The truthful meaning
 * lives in `status` + `error`.
 */
export interface ScannerResult {
  status: ScanStatus;
  passed: boolean | null;
  error?: string;
  [key: string]: unknown; // allows per-scanner extensions (e.g., ageDays, rawData)
}