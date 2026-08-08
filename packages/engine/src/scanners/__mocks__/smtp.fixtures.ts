/**
 * Shared test fixtures for the TlsScanner tests.
 *
 * Both the test file (for `beforeEach` resets) and the `vi.mock` factories
 * (via dynamic `import()` at factory-run time) read from this module, so the
 * mocked `node:net` / `node:tls` / `node:dns/promises` modules observe the same
 * mutable state the tests reconfigure per case. Living in its own module avoids
 * the `vi.hoisted` / `vi.mock` hoisting-ordering pitfalls of referencing hoisted
 * variables directly inside node-builtin mock factories.
 */

export type EmitterHandler = (...args: unknown[]) => void;

export type SmtpState = {
  mode:
    | 'happy'
    | 'ehlo-fail'
    | 'no-starttls'
    | 'socket-error'
    | 'tls-error'
    | 'no-mx';
  mx: Array<{ priority: number; exchange: string }>;
  cert: {
    valid_to?: string;
    subject: { CN: string };
    issuer: { CN: string };
    raw?: unknown;
  };
  protocol: string;
  cipher: { name: string };
};

/** Mutable state the mock SMTP conversation reads from. */
export const smtpState: SmtpState = {
  mode: 'happy',
  mx: [{ priority: 10, exchange: 'mx.example.com' }],
  cert: {
    valid_to: '2099-01-01T00:00:00.000Z',
    subject: { CN: 'mx.example.com' },
    issuer: { CN: 'ca.example.com' },
    raw: 'cert-bytes',
  },
  protocol: 'TLSv1.2',
  cipher: { name: 'AES256-GCM-SHA384' },
};

/** Tiny EventEmitter stand-in so no real `node:events` import is needed. */
export class FakeEmitter {
  private handlers: Record<string, EmitterHandler[]> = {};

  on(event: string, cb: EmitterHandler): this {
    (this.handlers[event] ??= []).push(cb);
    return this;
  }

  emit(event: string, ...args: unknown[]): this {
    for (const cb of this.handlers[event] ?? []) cb(...args);
    return this;
  }
}

/** State-machine-driven mock of `net.Socket` that speaks a scripted SMTP. */
export class MockSocket extends FakeEmitter {
  destroyed = false;

  connect(_port: number, _host: string): void {
    if (smtpState.mode === 'socket-error') {
      setTimeout(
        () => this.emit('error', new Error('connect ECONNREFUSED 127.0.0.1:25')),
        0,
      );
      return;
    }
    // Happy-path server greeting.
    setTimeout(() => {
      if (this.destroyed) return;
      this.emit('data', Buffer.from('220 mx.example.com ESMTP\r\n'));
    }, 0);
  }

  write(data: string | Buffer): boolean {
    const msg = data.toString();
    if (msg.startsWith('EHLO')) {
      setTimeout(() => {
        if (this.destroyed) return;
        const body =
          smtpState.mode === 'ehlo-fail'
            ? '500 Syntax error\r\n'
            : '250-mx.example.com\r\n250 OK\r\n';
        this.emit('data', Buffer.from(body));
      }, 0);
    } else if (msg.startsWith('STARTTLS')) {
      setTimeout(() => {
        if (this.destroyed) return;
        const body =
          smtpState.mode === 'no-starttls'
            ? '502 Command not implemented\r\n'
            : '220 Ready to start TLS\r\n';
        this.emit('data', Buffer.from(body));
      }, 0);
    }
    return true;
  }

  destroy(): void {
    this.destroyed = true;
  }

  // TLS-handshake API used by the scanner after tls.connect().
  getPeerCertificate(): SmtpState['cert'] {
    return smtpState.cert;
  }
  getProtocol(): string {
    return smtpState.protocol;
  }
  getCipher(): { name: string } {
    return smtpState.cipher;
  }
}
