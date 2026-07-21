import { DoHClient } from '../utils/doh.client';
import { BaseScanner, ScannerResult } from '../core/types';

export class DkimScanner implements BaseScanner {
  public readonly id = 'auth:dkim';
  public readonly description = 'Validates DomainKeys Identified Mail (DKIM) records, key sizes, and syntax (via DoH).';

  private static readonly COMMON_SELECTORS = ['google', 'selector1', 's1', 'default', 'm1', 'mail', 'k1'];

  async execute(domain: string, knownSelector?: string): Promise<ScannerResult> {
    const selectorsToCheck = knownSelector ? [knownSelector] : DkimScanner.COMMON_SELECTORS;
    let foundRecord: string | null = null;
    let successfulSelector: string | null = null;

    for (const selector of selectorsToCheck) {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      try {
        const records = await DoHClient.resolve(dkimDomain, 'TXT');
        const combined = records.map((r: any) => r.data ? r.data.replace(/"/g, '') : '');

        const dkim = combined.find((r: string) => r.startsWith('v=DKIM1') || r.includes('p='));

        if (dkim) {
          foundRecord = dkim;
          successfulSelector = selector;
          break;
        }
      } catch (err: any) {
         // Continue loop expecting failures on guessing
      }
    }

    if (!foundRecord) {
      return {
        scannerId: this.id,
        passed: false,
        scoreWeight: knownSelector ? 20 : 0,
        rawData: null,
        error: knownSelector
          ? `No DKIM record found for exact selector '${knownSelector}._domainkey.${domain}'.`
          : 'No DKIM record discovered via common selector guessing.',
        flags: ['DKIM_NOT_FOUND']
      };
    }

    const params = new URLSearchParams(foundRecord.replace(/;\s*/g, '&'));
    const p = params.get('p');
    const v = params.get('v');
    const k = params.get('k') || 'rsa';

    const flags: string[] = [];
    let passed = true;
    let errorStr = '';

    if (!p || p === '') {
      passed = false;
      errorStr = 'DKIM record is missing the public key data (p= tag).';
      flags.push('DKIM_MISSING_KEY');
    }

    if (v && v !== 'DKIM1') {
       passed = false;
       errorStr += ' DKIM version must be "DKIM1".';
       flags.push('DKIM_INVALID_VERSION');
    }

    if (p && k === 'rsa') {
       if (p.length < 200) {
         flags.push('DKIM_WEAK_KEY_SIZE_1024_OR_LESS');
       }
       if (p.length >= 380) {
         flags.push('DKIM_STRONG_KEY_SIZE_2048');
       }
    }

    return {
      scannerId: this.id,
      passed,
      scoreWeight: passed ? 0 : 20,
      rawData: { record: foundRecord, selector: successfulSelector, type: k },
      error: errorStr || undefined,
      flags
    };
  }
}
