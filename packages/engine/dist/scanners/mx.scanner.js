import * as dns from 'node:dns/promises';
export class MxScanner {
    id = 'network:mx';
    description = 'Validates Mail Exchange (MX) records capability to receive bounces.';
    async execute(domain) {
        try {
            const records = await dns.resolveMx(domain);
            if (records.length === 0) {
                return {
                    scannerId: this.id,
                    passed: false,
                    scoreWeight: 20,
                    rawData: [],
                    error: "No MX records found. Domain cannot receive replies or bounces.",
                    flags: ['MISSING_MX']
                };
            }
            // Check for Null MX record (RFC 7505) which explicitly states "this domain accepts no mail"
            if (records[0].exchange === '.' || records[0].exchange === '') {
                return {
                    scannerId: this.id,
                    passed: false, // For a sending domain, rejecting mail is bad (breaks inbound loop).
                    scoreWeight: 20,
                    rawData: records,
                    error: "Domain has a Null MX record, deliberately blocking inbound mail.",
                    flags: ['NULL_MX']
                };
            }
            const sorted = records.sort((a, b) => a.priority - b.priority);
            return {
                scannerId: this.id,
                passed: true,
                scoreWeight: 0,
                rawData: sorted,
                flags: []
            };
        }
        catch (err) {
            if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
                return { scannerId: this.id, passed: false, scoreWeight: 20, rawData: null, error: "No MX records found.", flags: ['MISSING_MX'] };
            }
            throw err;
        }
    }
}
