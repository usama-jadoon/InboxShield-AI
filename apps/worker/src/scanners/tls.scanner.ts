import * as tls from 'node:tls';

export class TlsScanner {
  /**
   * Evaluates the SSL/TLS certificate of the mail server.
   */
  static async verifyCertificate(mxRecordUrl: string): Promise<{ passed: boolean; validDaysRemaining: number; error?: string }> {
    return new Promise((resolve) => {
      const socket = tls.connect(443, mxRecordUrl, { servername: mxRecordUrl }, () => {
        const cert = socket.getPeerCertificate();
        socket.destroy();

        if (!cert || !cert.valid_to) {
          return resolve({ passed: false, validDaysRemaining: 0, error: 'No certificate found' });
        }

        const validTo = new Date(cert.valid_to).getTime();
        const now = Date.now();
        const daysRemaining = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

        if (daysRemaining < 0) {
           return resolve({ passed: false, validDaysRemaining: daysRemaining, error: 'Certificate expired' });
        }

        resolve({ passed: true, validDaysRemaining: daysRemaining });
      });

      socket.on('error', (err) => {
         resolve({ passed: false, validDaysRemaining: 0, error: err.message });
      });
      
      socket.setTimeout(3000, () => {
         socket.destroy();
         resolve({ passed: false, validDaysRemaining: 0, error: 'TLS connection timed out' });
      });
    });
  }
}
