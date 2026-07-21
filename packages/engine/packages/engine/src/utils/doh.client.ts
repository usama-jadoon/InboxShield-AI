import https from 'node:https';

/**
 * DNS over HTTPS (DoH) Client
 * Bypasses local network restrictions (like strict outbound port 53 firewalls)
 * by fetching DNS records directly from Cloudflare via encrypted HTTP.
 */
export class DoHClient {
  private static readonly ENDPOINT = 'cloudflare-dns.com';

  static async resolve(domain: string, type: 'A' | 'TXT' | 'MX'): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.ENDPOINT,
        port: 443,
        path: `/dns-query?name=${encodeURIComponent(domain)}&type=${type}`,
        method: 'GET',
        headers: {
          'Accept': 'application/dns-json'
        },
        timeout: 5000
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode !== 200) {
             return reject(new Error(`DoH query failed with status: ${res.statusCode}`));
          }
          try {
            const json = JSON.parse(body);
            if (json.Status !== 0) {
              return reject(new Error(`NXDOMAIN or similar DNS error. Status: ${json.Status}`));
            }
            resolve(json.Answer || []);
          } catch (e) {
            reject(new Error("Failed to parse DoH response."));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('DoH Timeout')); });
      req.end();
    });
  }
}
