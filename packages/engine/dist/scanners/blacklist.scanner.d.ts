import { BaseScanner, ScannerResult } from '../core/types';
export declare class BlacklistScanner implements BaseScanner {
    readonly id = "network:blacklist:domain";
    readonly description = "Checks domain against high-reputation Domain Blocklists (DBL).";
    private static readonly DBL_LIST;
    execute(domain: string): Promise<ScannerResult>;
}
