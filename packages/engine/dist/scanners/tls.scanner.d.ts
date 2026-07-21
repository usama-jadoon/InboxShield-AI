import { BaseScanner, ScannerResult } from '../core/types';
export declare class TlsScanner implements BaseScanner {
    readonly id = "network:tls";
    readonly description = "Validates if the primary MX record supports SSL/TLS termination and checks certificate expiry.";
    execute(domain: string, mxRecord?: string): Promise<ScannerResult>;
}
