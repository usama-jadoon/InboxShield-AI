import { DnsScanner } from "./dns.scanner";

export class DkimScanner {
  /**
   * DKIM checking strictly requires the selector used by the ESP.
   * e.g., selector 's1' -> s1._domainkey.domain.com
   */
  static async verify(domain: string, selector: string): Promise<{ passed: boolean; record: string | null; error?: string }> {
    if (!selector) {
      return { passed: false, record: null, error: "Selector string is required to perform DKIM lookup." };
    }

    const dkimDomain = `${selector}._domainkey.${domain}`;
    const txtRecords = await DnsScanner.getTxtRecords(dkimDomain);
    
    // DKIM records must start with v=DKIM1 or k=rsa
    const dkimRecords = txtRecords.filter(record => record.startsWith('v=DKIM1') || record.includes('p='));

    if (dkimRecords.length === 0) {
      return { passed: false, record: null, error: `No DKIM record found at ${dkimDomain}.` };
    }

    return { passed: true, record: dkimRecords[0] };
  }
}
