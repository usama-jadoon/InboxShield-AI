import { ScanStatus, ScannerResult } from './types';

export class WhoisScanner {
  static async verify(_domain: string): Promise<ScannerResult> {
    // Note: Node.js has no native built-in whois protocol parsing.
    // In production, we'd use a dependency like `whois-json` or call a whois API.
    // This is a stub for the enterprise standard checking if a domain was registered < 30 days ago (major spam flag).
    return {
      status: 'UNSUPPORTED' as ScanStatus,
      passed: null,
      ageDays: null,
      error: 'WHOIS lookup not implemented — requires external API dependency'
    };
  }
}
