import * as tls from 'node:tls';
import { BaseScanner, ScannerResult } from '../core/types';

export class TlsScanner implements BaseScanner {
  public readonly id = 'network:tls';
  public readonly description = 'Validates if the primary MX record supports SSL/TLS termination and checks certificate expiry.';

  async execute(domain: string, mxRecord?: string): Promise<ScannerResult> {
    if (!mxRecord) {
      return {
        scannerId: this.id,
        passed: false,
        scoreWeight: 0, 
        rawData: null,
        error: "Cannot perform TLS scan without a valid MX record target.",
        flags: ['SKIPPED_NO_MX']
      };
    }

    return new Promise((resolve) => {
      const socket = tls.connect(443, mxRecord, { servername: mxRecord }, () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (!cert || !cert.valid_to) {
          resolve({
            scannerId: this.id,
            passed: false,
            scoreWeight: 15, // Penalty: Insecure mail transit
            rawData: null,
            error: `No valid TLS certificate found on MX host ${mxRecord}.`,
            flags: ['NO_TLS_CERT']
          });
          return;
        }

        const validTo = new Date(cert.valid_to).getTime();
        const daysRemaining = Math.floor((validTo - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
           resolve({
             scannerId: this.id,
             passed: false,
             scoreWeight: 20, 
             rawData: cert.valid_to,
             error: `TLS Certificate expired ${Math.abs(daysRemaining)} days ago.`,
             flags: ['TLS_EXPIRED']
           });
           return;
        }

        resolve({
          scannerId: this.id,
          passed: true,
          scoreWeight: 0,
          rawData: { daysRemaining, validTo: cert.valid_to, subject: cert.subject },
          flags: daysRemaining < 14 ? ['TLS_EXPIRING_SOON'] : []
        });
      });

      socket.on('error', (err) => {
         resolve({
           scannerId: this.id,
           passed: false,
           scoreWeight: 15,
           rawData: null,
           error: `TLS handshake failed: ${err.message}`,
           flags: ['TLS_HANDSHAKE_ERROR']
         });
      });
      
      socket.setTimeout(3000, () => {
         socket.destroy();
         resolve({
           scannerId: this.id,
           passed: false,
           scoreWeight: 10,
           rawData: null,
           error: 'TLS connection timed out.',
           flags: ['TLS_TIMEOUT']
         });
      });
    });
  }
}
