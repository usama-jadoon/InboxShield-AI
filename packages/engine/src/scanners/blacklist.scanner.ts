import * as dns from 'node:dns/promises';
import { BaseScanner, ScannerResult } from '../core/types';

export class BlacklistScanner implements BaseScanner {
  public readonly id = 'network:blacklist:domain';
  public readonly description = 'Checks domain against high-reputation Domain Blocklists (DBL).';

  private static readonly DBL_LIST = ['dbl.spamhaus.org', 'multi.surbl.org'];

  async execute(domain: string): Promise<ScannerResult> {
    const listedOn: string[] = [];

    const checks = BlacklistScanner.DBL_LIST.map(async (dbl) => {
      const query = `${domain}.${dbl}`;
      try {
        const records = await dns.resolve(query, 'A');
        if (records.length > 0) {
          listedOn.push(dbl);
        }
      } catch (err: any) {
        // ENOTFOUND means it is NOT listed (this is the happy path for an RBL).
        if (err.code !== 'ENOTFOUND' && err.code !== 'ENODATA') {
          // Actual network error
        }
      }
    });

    await Promise.allSettled(checks);

    const isListed = listedOn.length > 0;

    return {
      scannerId: this.id,
      passed: !isListed,
      scoreWeight: isListed ? 50 : 0, // Massive penalty, domain is physically blocked.
      rawData: listedOn,
      error: isListed ? `Domain heavily listed on: ${listedOn.join(', ')}` : undefined,
      flags: isListed ? ['DOMAIN_BLACKLISTED'] : []
    };
  }
}
