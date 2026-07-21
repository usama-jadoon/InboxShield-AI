import * as net from 'node:net';

export class SmtpScanner {
  /**
   * Attempts to open a TCP connection to the domain's MX records on port 25
   * to verify if they accept incoming connections (basic SMTP banner grab).
   */
  static async checkPort25(mxRecordUrl: string): Promise<{ passed: boolean; error?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(3000); // 3 second timeout for speed

      socket.on('connect', () => {
        socket.destroy();
        resolve({ passed: true });
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve({ passed: false, error: 'Connection timed out on port 25' });
      });

      socket.on('error', (err) => {
        socket.destroy();
        resolve({ passed: false, error: err.message });
      });

      socket.connect(25, mxRecordUrl);
    });
  }
}
