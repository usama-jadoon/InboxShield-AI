import * as dns from 'node:dns/promises';
export class BlacklistScanner {
    id = 'network:blacklist:domain';
    description = 'Checks domain against high-reputation Domain Blocklists (DBL).';
    static DBL_LIST = ['dbl.spamhaus.org', 'multi.surbl.org'];
    async execute(domain) {
        const listedOn = [];
        const checks = BlacklistScanner.DBL_LIST.map(async (dbl) => {
            const query = `${domain}.${dbl}`;
            try {
                const records = await dns.resolve(query, 'A');
                if (records.length > 0) {
                    listedOn.push(dbl);
                }
            }
            catch (err) {
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
