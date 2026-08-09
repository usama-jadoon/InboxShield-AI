// Stubs for Phase 7 (Reports Export) — NOT IMPLEMENTED
// These methods explicitly throw to prevent fabricated output from being presented as real.

export class ReportGenerator {
  static async exportToCSV(_domainId: string): Promise<string> {
    throw new Error('Report export not implemented — CSV export requires database wiring and CSV generation logic');
  }

  static async generatePDFSummary(_domainId: string): Promise<Buffer> {
    throw new Error('Report export not implemented — PDF export requires database wiring and PDF generation logic');
  }
}
