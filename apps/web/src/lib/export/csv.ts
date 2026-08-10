/**
 * @file V1-10: CSV export from scan history.
 *
 * Pure, deterministic CSV serialization of ScanReport rows (RFC 4180).
 * No I/O — the caller (API route) owns file naming and response headers.
 */
import type { ScanReport } from '@prisma/client';

const HEADER: readonly string[] = ['scanId', 'score', 'riskLevel', 'createdAt'];

/** Escape a single CSV field per RFC 4180: quote if it contains `,`, `"`, or newline. */
export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Serialize scan history rows into a CSV string with a header row.
 * Rows are ordered exactly as provided (caller controls ordering — typically
 * most-recent-first from ScanService.listByDomain).
 */
export function scanHistoryToCsv(reports: readonly ScanReport[]): string {
  const rows = reports.map((r) =>
    [
      csvEscape(r.id),
      csvEscape(String(r.score)),
      csvEscape(r.riskLevel),
      csvEscape(r.createdAt.toISOString()),
    ].join(','),
  );
  return [HEADER.join(','), ...rows].join('\r\n');
}
