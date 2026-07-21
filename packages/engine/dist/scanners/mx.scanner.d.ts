import { BaseScanner, ScannerResult } from '../core/types';
export declare class MxScanner implements BaseScanner {
    readonly id = "network:mx";
    readonly description = "Validates Mail Exchange (MX) records capability to receive bounces (via DoH).";
    execute(domain: string): Promise<ScannerResult>;
}
