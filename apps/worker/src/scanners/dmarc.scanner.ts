import { DnsScanner } from "./dns.scanner";

export class DmarcScanner {
  /**
   * Evaluates the _dmarc record for a domain.
   */
  static async verify(domain: string): Promise<{ passed: boolean; record: string | null; policy: string | null; error?: string }> {
    const dmarcDomain = `_dmarc.${domain}`;
    const txtRecords = await DnsScanner.getTxtRecords(dmarcDomain);
    
    const dmarcRecords = txtRecords.filter(record => record.toLowerCase().startsWith('v=dmarc1'));

    if (dmarcRecords.length === 0) {
      return { passed: false, record: null, policy: null, error: "No DMARC record found." };
    }

    if (dmarcRecords.length > 1) {
      return { passed: false, record: null, policy: null, error: "Multiple DMARC records found." };
    }

    const record = dmarcRecords[0];
    
    // Extract policy (p=none, p=quarantine, p=reject)
    const policyMatch = record.match(/p=(none|quarantine|reject)/i);
    const policy = policyMatch ? policyMatch[1].toLowerCase() : null;

    if (!policy) {
      return { passed: false, record, policy: null, error: "DMARC record missing enforceable policy (p=)." };
    }

    return { passed: true, record, policy };
  }
}
