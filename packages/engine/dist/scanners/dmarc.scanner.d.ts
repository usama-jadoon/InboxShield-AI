import { BaseScanner, ScannerResult } from '../core/types';
export declare class DmarcScanner implements BaseScanner {
    readonly id = "auth:dmarc";
    readonly description = "Validates DMARC record positioning and policy strictness (via DoH).";
    execute(domain: string): Promise<ScannerResult>;
}
