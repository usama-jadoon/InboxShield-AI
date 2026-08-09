import * as net from 'node:net';
import { ScanStatus, ScannerResult } from './types';

export class SmtpScanner {
  /**
   * Attempts to open a TCP connection to the domain's MX records on port 25
   * to verify if they accept incoming connections.
   *
   * SCOPE NOTE: This check verifies PORT 25 REACHABILITY ONLY.
   * It does NOT perform SMTP banner analysis, EHLO command, STARTTLS negotiation,
   * or certificate validation. Those are unimplemented.
   * The result is reported as PARTIAL — no overall SMTP validation verdict is implied.
   * For full SMTP/TLS validation, see the engine's network:smtp:tls scanner.
   */
  static async checkPort25(mxRecordUrl: string): Promise<ScannerResult> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000); // 3 second timeout for speed

      socket.on('connect', () => {
        socket.destroy();
        resolve({
          status: 'PARTIAL' as ScanStatus,
          passed: null,
          rawData: { reachable: true, port: 25, host: mxRecordUrl },
          error: 'SMTP banner/EHLO/STARTTLS analysis not implemented — this result covers TCP port-25 reachability only'
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({
          status: 'PARTIAL' as ScanStatus,
          passed: null,
          rawData: { reachable: false, port: 25, host: mxRecordUrl, timeout: true },
          error: 'Connection timed out on port 25 (SMTP banner/EHLO/STARTTLS analysis not implemented)'
        });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({
          status: 'PARTIAL' as ScanStatus,
          passed: null,
          rawData: { reachable: false, port: 25, host: mxRecordUrl, error: err.message },
          error: `TCP connect error: ${err.message} (SMTP banner/EHLO/STARTTLS analysis not implemented)`
        });
      });

      socket.connect(25, mxRecordUrl);
    });
  }
}
