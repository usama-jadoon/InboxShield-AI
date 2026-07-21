import { DoHClient } from '../utils/doh.client';
import { BaseScanner, ScannerResult } from '../core/types';

export class DmarcScanner implements BaseScanner {
  public readonly id = 'auth:dmarc';
  public readonly description = 'Validates DMARC record positioning and policy strictness (via DoH).';

  async execute(domain: string): Promise<ScannerResult> {
    const targetDomain = `_dmarc.${domain}`;
    try {
      const records = await DoHClient.resolve(targetDomain, 'TXT');
      const dmarcRecords = records.map((r: any) => r.data ? r.data.replace(/"/g, '') : '').filter((record: string) => record.toLowerCase().startsWith('v=dmarc1'));

      if (dmarcRecords.length === 0) {
        return {
          scannerId: this.id,
          passed: false,
          scoreWeight: 40,
          rawData: null,
          error: `No DMARC record found at ${targetDomain}.`,
          flags: ['MISSING_DMARC']
        };
      }

      if (dmarcRecords.length > 1) {
        return {
          scannerId: this.id, passed: false, scoreWeight: 40, rawData: dmarcRecords,
          error: "Multiple DMARC records found.", flags: ['DUPLICATE_DMARC']
        };
      }

      const activeRecord = dmarcRecords[0];
      const policyMatch = activeRecord.match(/p=(none|quarantine|reject)/i);
      const policy = policyMatch ? policyMatch[1].toLowerCase() : null;

      let passed = true;
      let error: string | undefined = undefined;
      const flags: string[] = [];
      let scoreWeight = 0;

      if (!policy) {
        passed = false; error = "DMARC missing actionable 'p=' policy.";
        flags.push('MALFORMED_DMARC'); scoreWeight = 40;
      } else if (policy === 'none') {
        passed = false; error = "DMARC policy set to 'none' offers no spoofing protection.";
        flags.push('MONITORING_ONLY_DMARC'); scoreWeight = 15;
      }

      return { scannerId: this.id, passed, scoreWeight, rawData: activeRecord, error, flags };
    } catch (err: any) {
      return { scannerId: this.id, passed: false, scoreWeight: 40, rawData: null, error: `No DMARC record found. ${err.message}`, flags: ['MISSING_DMARC'] };
    }
  }
}
