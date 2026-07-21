import { DoHClient } from '../utils/doh.client';
export class SpfScanner {
    id = 'auth:spf';
    description = 'Validates Sender Policy Framework (SPF) TXT records and syntax (via DoH).';
    async execute(domain) {
        try {
            const records = await DoHClient.resolve(domain, 'TXT');
            const combinedRecords = records.map((r) => r.data ? r.data.replace(/"/g, '') : '');
            const spfRecords = combinedRecords.filter((record) => record.toLowerCase().startsWith('v=spf1'));
            if (spfRecords.length === 0) {
                return {
                    scannerId: this.id,
                    passed: false,
                    scoreWeight: 30,
                    rawData: combinedRecords,
                    error: "No SPF record found.",
                    flags: ['MISSING_SPF']
                };
            }
            if (spfRecords.length > 1) {
                return {
                    scannerId: this.id,
                    passed: false,
                    scoreWeight: 30,
                    rawData: spfRecords,
                    error: "Multiple SPF records found. This violates RFC 7208.",
                    flags: ['DUPLICATE_SPF']
                };
            }
            const activeRecord = spfRecords[0];
            const hasPolicy = activeRecord.includes('~all') || activeRecord.includes('-all') || activeRecord.includes('?all');
            return {
                scannerId: this.id,
                passed: hasPolicy,
                scoreWeight: 20,
                rawData: activeRecord,
                error: hasPolicy ? undefined : "SPF lacks definitive termination policy (e.g. ~all or -all).",
                flags: hasPolicy ? [] : ['WEAK_SPF_POLICY']
            };
        }
        catch (err) {
            return { scannerId: this.id, passed: false, scoreWeight: 30, rawData: null, error: `No TXT records found. ${err.message}`, flags: ['MISSING_SPF'] };
        }
    }
}
