import { DoHClient } from '../utils/doh.client';
import { BaseScanner, ScannerResult } from '../core/types';

export class MxScanner implements BaseScanner {
  public readonly id = 'network:mx';
  public readonly description = 'Validates Mail Exchange (MX) records capability to receive bounces (via DoH).';

  async execute(domain: string): Promise<ScannerResult> {
    try {
      const records = await DoHClient.resolve(domain, 'MX');

      if (records.length === 0) {
        return { scannerId: this.id, passed: false, scoreWeight: 20, rawData: [], error: "No MX records found.", flags: ['MISSING_MX'] };
      }

      const mappedRecords = records.map((r: any) => {
         const parts = r.data.split(' ');
         if(parts.length > 1) return { priority: parseInt(parts[0], 10), exchange: parts[1] };
         return { priority: 10, exchange: r.data };
      });

      if (mappedRecords[0].exchange === '.' || mappedRecords[0].exchange === '') {
        return { scannerId: this.id, passed: false, scoreWeight: 20, rawData: mappedRecords, error: "Null MX record detected.", flags: ['NULL_MX'] };
      }

      const sorted = mappedRecords.sort((a: any, b: any) => a.priority - b.priority);

      return { scannerId: this.id, passed: true, scoreWeight: 0, rawData: sorted, flags: [] };

    } catch (err: any) {
      return { scannerId: this.id, passed: false, scoreWeight: 20, rawData: null, error: "No MX records found.", flags: ['MISSING_MX'] };
    }
  }
}
