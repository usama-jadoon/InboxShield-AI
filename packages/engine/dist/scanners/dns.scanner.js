import { DoHClient } from '../utils/doh.client';
export class DnsScanner {
    id = 'network:dns:a_record';
    description = 'Validates physical resolution of the domain via A/AAAA records (via DoH).';
    async execute(domain) {
        try {
            const records = await DoHClient.resolve(domain, 'A');
            const passed = records.length > 0;
            return {
                scannerId: this.id,
                passed,
                scoreWeight: 20,
                rawData: records.map((r) => r.data),
                error: passed ? undefined : "No A records found for domain.",
                flags: passed ? [] : ['NO_RESOLUTION']
            };
        }
        catch (err) {
            return {
                scannerId: this.id,
                passed: false,
                scoreWeight: 20,
                rawData: null,
                error: `DNS Lookup failed: ${err.message}`,
                flags: ['DNS_ERROR']
            };
        }
    }
}
