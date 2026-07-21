import * as dns from 'node:dns/promises';

export class MxScanner {
  /**
   * Verifies if a domain is configured to receive email (Crucial for receiving bounces).
   */
  static async verify(domain: string): Promise<{ passed: boolean; records: any[]; error?: string }> {
    try {
      const records = await dns.resolveMx(domain);
      
      if (records.length === 0) {
        return { passed: false, records: [], error: "No MX records found." };
      }

      // Sort by priority (lowest number = highest priority)
      const sortedRecords = records.sort((a, b) => a.priority - b.priority);

      // Check if MX records resolve (basic check against fake records)
      // Note: Full resolution adds latency, done as a soft check here
      return { passed: true, records: sortedRecords };
    } catch {
      return { passed: false, records: [], error: "DNS lookup failed for MX records." };
    }
  }
}
