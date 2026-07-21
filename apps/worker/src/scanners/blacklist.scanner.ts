import { DnsScanner } from "./dns.scanner";

export class BlacklistScanner {
  // Top tier reliable DNSBLs
  private static readonly RBL_LIST = [
    'zen.spamhaus.org',
    'b.barracudacentral.org',
    'bl.spamcop.net'
  ];

  /**
   * Reverses an IP address for DNSBL querying.
   * e.g. 192.168.1.1 -> 1.1.168.192
   */
  private static reverseIp(ip: string): string | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    return parts.reverse().join('.');
  }

  /**
   * Checks an IP address against major real-time blacklists.
   */
  static async checkIp(ip: string): Promise<{ isListed: boolean; listedOn: string[] }> {
    const reversedIp = this.reverseIp(ip);
    if (!reversedIp) {
      throw new Error("Invalid IPv4 address format.");
    }

    const listedOn: string[] = [];
    
    // Check all RBLs concurrently
    const checks = this.RBL_LIST.map(async (rbl) => {
      const query = `${reversedIp}.${rbl}`;
      const result = await DnsScanner.checkARecords(query);
      if (result.passed) {
        listedOn.push(rbl);
      }
    });

    // We don't want a DNS timeout to fail the whole process, so we use allSettled
    await Promise.allSettled(checks);

    return {
      isListed: listedOn.length > 0,
      listedOn
    };
  }

  /**
   * Checks if a Domain is on Domain Blocklists (DBL)
   */
  static async checkDomain(domain: string): Promise<{ isListed: boolean; listedOn: string[] }> {
    const DBL_LIST = ['dbl.spamhaus.org'];
    const listedOn: string[] = [];

    const checks = DBL_LIST.map(async (dbl) => {
      const query = `${domain}.${dbl}`;
      const result = await DnsScanner.checkARecords(query);
      if (result.passed) {
        listedOn.push(dbl);
      }
    });

    await Promise.allSettled(checks);

    return {
      isListed: listedOn.length > 0,
      listedOn
    };
  }
}
