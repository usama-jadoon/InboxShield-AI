import { DnsScanner } from "./dns.scanner";

export class SpfScanner {
  /**
   * Verifies if a valid SPF record exists for the domain.
   */
  static async verify(domain: string): Promise<{ passed: boolean; record: string | null; error?: string }> {
    const txtRecords = await DnsScanner.getTxtRecords(domain);
    
    // An SPF record must exactly start with "v=spf1"
    const spfRecords = txtRecords.filter(record => record.toLowerCase().startsWith('v=spf1'));

    if (spfRecords.length === 0) {
      return { passed: false, record: null, error: "No SPF record found." };
    }

    if (spfRecords.length > 1) {
      return { passed: false, record: null, error: "Multiple SPF records found. This violates RFC 7208." };
    }

    const record = spfRecords[0];
    
    // Extremely basic syntax validation
    if (!record.includes('~all') && !record.includes('-all') && !record.includes('?all')) {
       return { passed: false, record, error: "SPF record missing enforcement policy (~all or -all)." };
    }

    return { passed: true, record };
  }
}
