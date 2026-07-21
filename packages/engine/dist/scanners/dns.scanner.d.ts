import { BaseScanner, ScannerResult } from '../core/types';
export declare class DnsScanner implements BaseScanner {
    readonly id = "network:dns:a_record";
    readonly description = "Validates physical resolution of the domain via A/AAAA records.";
    execute(domain: string): Promise<ScannerResult>;
}
