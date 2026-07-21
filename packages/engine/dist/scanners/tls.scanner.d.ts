import { BaseScanner, ScannerResult } from '../core/types';
export declare class TlsScanner implements BaseScanner {
    readonly id = "network:smtp:tls";
    readonly description = "Validates SMTP STARTTLS support, TLS version, cipher, and certificate expiry on the primary MX.";
    execute(domain: string, presetMx?: string): Promise<ScannerResult>;
}
