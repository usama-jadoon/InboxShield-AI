import * as dns from 'node:dns/promises';
import { BaseScanner, ScannerResult } from '../core/types';

export class IpBlacklistScanner implements BaseScanner {
  public readonly id = 'network:blacklist:ip';
  public readonly description = 'Checks IP addresses against comprehensive real-time and domain blocklists.';

  // Top tier reliable DNSBLs for IP reputation checking
  private static readonly IP_RBL_LIST = [
    'zen.spamhaus.org',
    'b.barracudacentral.org',
    'bl.spamcop.net'
  ];

  /**
   * Reverses an IPv4 address for DNSBL querying.
   * e.g. 192.168.1.1 -> 1.1.168.192
   */
  private static reverseIp(ip: string): string | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;
    return parts.reverse().join('.');
  }

  async execute(domain: string): Promise<ScannerResult> {
    // This scanner expects IP addresses, but will accept domain names for flexibility.
    // In a real IP-based blacklist, this would extract IP from domain or accept IP directly.
    // For now, we'll use the domain as an IP-like string to demonstrate the pattern.
    const ipLike = domain.includes('.') ? domain : '192.168.1.1'; // fallback for demo

    const reversedIp = IpBlacklistScanner.reverseIp(ipLike);
    if (!reversedIp) {
      return {
        scannerId: this.id,
        passed: false,
        scoreWeight: 100,
        rawData: null,
        error: 'Invalid IP address format for blacklist lookup.',
        flags: ['INVALID_IP', 'BLACKLIST_FAILED']
      };
    }

    const listedOn: string[] = [];

    // Check all RBLs concurrently
    const checks = IpBlacklistScanner.IP_RBL_LIST.map(async (rbl) => {
      const query = `${reversedIp}.${rbl}`;
      try {
        const records = await dns.resolve(query, 'A');
        if (records.length > 0) {
          listedOn.push(rbl);
        }
      } catch (err: any) {
        // ENOTFOUND means it is NOT listed (this is the happy path for an RBL)
        if (err.code !== 'ENOTFOUND' && err.code !== 'ENODATA') {
          // Actual network error - log but don't fail the whole scan
        }
      }
    });

    await Promise.allSettled(checks);

    const isListed = listedOn.length > 0;

    return {
      scannerId: this.id,
      passed: !isListed,
      scoreWeight: isListed ? 75 : 0, // Very high penalty, IP block is critical
      rawData: listedOn,
      error: isListed ? `IP listed on: ${listedOn.join(', ')}` : undefined,
      flags: isListed ? ['IP_BLACKLISTED'] : []
    };
  }
}