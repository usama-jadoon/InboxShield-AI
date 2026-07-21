import * as dns from 'node:dns/promises';
export class DmarcScanner {
    id = 'auth:dmarc';
    description = 'Validates Domain-based Message Authentication, Reporting, and Conformance (DMARC).';
    async execute(domain) {
        const targetDomain = `_dmarc.${domain}`;
        try {
            const records = await dns.resolveTxt(targetDomain);
            const dmarcRecords = records.map(arr => arr.join('')).filter(record => record.toLowerCase().startsWith('v=dmarc1'));
            if (dmarcRecords.length === 0) {
                return {
                    scannerId: this.id,
                    passed: false,
                    scoreWeight: 40, // Highest penalty. Google/Yahoo blocked sending without it after 2024.
                    rawData: null,
                    error: `No DMARC record found at ${targetDomain}.`,
                    flags: ['MISSING_DMARC']
                };
            }
            if (dmarcRecords.length > 1) {
                return {
                    scannerId: this.id,
                    passed: false,
                    scoreWeight: 40,
                    rawData: dmarcRecords,
                    error: "Multiple DMARC records found.",
                    flags: ['DUPLICATE_DMARC']
                };
            }
            const activeRecord = dmarcRecords[0];
            const policyMatch = activeRecord.match(/p=(none|quarantine|reject)/i);
            const policy = policyMatch ? policyMatch[1].toLowerCase() : null;
            let passed = true;
            let error = undefined;
            const flags = [];
            let scoreWeight = 0;
            if (!policy) {
                passed = false;
                error = "DMARC missing actionable 'p=' policy.";
                flags.push('MALFORMED_DMARC');
                scoreWeight = 40;
            }
            else if (policy === 'none') {
                passed = false; // "none" is a monitoring state, not a protective state.
                error = "DMARC policy set to 'none' offers no spoofing protection.";
                flags.push('MONITORING_ONLY_DMARC');
                scoreWeight = 15; // Soft penalty, better than nothing but not passing.
            }
            return {
                scannerId: this.id,
                passed,
                scoreWeight,
                rawData: activeRecord,
                error,
                flags
            };
        }
        catch (err) {
            if (err.code === 'ENODATA' || err.code === 'ENOTFOUND') {
                return { scannerId: this.id, passed: false, scoreWeight: 40, rawData: null, error: `No DMARC record found at ${targetDomain}.`, flags: ['MISSING_DMARC'] };
            }
            throw err;
        }
    }
}
