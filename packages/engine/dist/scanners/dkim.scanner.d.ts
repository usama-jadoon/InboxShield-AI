import { BaseScanner, ScannerResult } from '../core/types';
export declare class DkimScanner implements BaseScanner {
    readonly id = "auth:dkim";
    readonly description = "Validates DomainKeys Identified Mail (DKIM) records, key sizes, and syntax (via DoH).";
    private static readonly COMMON_SELECTORS;
    execute(domain: string, knownSelector?: string): Promise<ScannerResult>;
}
