import * as dns from 'node:dns/promises';
export class DnsScanner {
    id = 'network:dns:a_record';
    description = 'Validates physical resolution of the domain via A/AAAA records.';
    async execute(domain) {
        try {
            const records = await dns.resolve(domain, 'A');
            const passed = records.length > 0;
            return {
                scannerId: this.id,
                passed,
                scoreWeight: 20, // High penalty, if it doesn't resolve it doesn't exist
                rawData: records,
                error: passed ? undefined : "No A records found for domain. Domain may not physically resolve.",
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
