/**
 * DNS over HTTPS (DoH) Client
 * Bypasses local network restrictions (like strict outbound port 53 firewalls)
 * by fetching DNS records directly from Cloudflare via encrypted HTTP.
 */
export declare class DoHClient {
    private static readonly ENDPOINT;
    static resolve(domain: string, type: 'A' | 'TXT' | 'MX'): Promise<any[]>;
}
