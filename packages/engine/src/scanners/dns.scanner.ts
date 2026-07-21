import * as dns from 'node:dns/promises';
import { BaseScanner, ScannerResult } from '../core/types';

export class DnsScanner implements BaseScanner {
  public readonly id = 'network:dns:a_record';
  public readonly description = 'Validates physical resolution of the domain via A/AAAA records.';

  async execute(domain: string): Promise<ScannerResult> {
    try {
      const records = await dns.resolve(domain, 'A');
      const passed = records.length > 0;
      
      return {
        scannerId: this.id,
        passed,
        scoreWeight: 20, // High penalty, if it doesn't resolve it doesn't exist
        rawData: records,
        error: passed ? undefined : "No A records found for domain. Domain may not physically resolve.",
        flags: passed ? [] : ['NO_RESOLUTION']
      };
    } catch (err: any) {
      return {
        scannerId: this.id,
        passed: false,
        scoreWeight: 20,
        rawData: null,
        error: `DNS Lookup failed: ${err.message}`,
        flags: ['DNS_ERROR']
      };
    }
  }
}
