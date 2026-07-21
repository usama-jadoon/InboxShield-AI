import { BaseScanner, ScannerResult } from '../core/types';
export declare class DmarcScanner implements BaseScanner {
    readonly id = "auth:dmarc";
    readonly description = "Validates Domain-based Message Authentication, Reporting, and Conformance (DMARC).";
    execute(domain: string): Promise<ScannerResult>;
}
