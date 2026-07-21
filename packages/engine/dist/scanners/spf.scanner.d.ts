import { BaseScanner, ScannerResult } from '../core/types';
export declare class SpfScanner implements BaseScanner {
    readonly id = "auth:spf";
    readonly description = "Validates Sender Policy Framework (SPF) TXT records and syntax (via DoH).";
    execute(domain: string): Promise<ScannerResult>;
}
