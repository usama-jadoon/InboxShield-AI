import * as dns from 'node:dns/promises';

export class DnsScanner {
  /**
   * Checks if a domain has valid A or AAAA records.
   */
  static async checkARecords(domain: string): Promise<{ passed: boolean; records: string[] }> {
    try {
      const records = await dns.resolve(domain, 'A');
      return { passed: records.length > 0, records };
    } catch {
      return { passed: false, records: [] };
    }
  }

  /**
   * Parses specific TXT records from the domain
   */
  static async getTxtRecords(domain: string): Promise<string[]> {
    try {
      const records = await dns.resolveTxt(domain);
      return records.map(arr => arr.join(''));
    } catch {
      return [];
    }
  }
}
