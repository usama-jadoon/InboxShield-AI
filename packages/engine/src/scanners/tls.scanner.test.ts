import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MockSocket, smtpState } from './__mocks__/smtp.fixtures';
import { TlsScanner } from './tls.scanner';

// ---------------------------------------------------------------------------
// Module mocks — each reads from the shared `smtpState` fixture via dynamic
// import at factory-run time, so tests can reconfigure the conversation per
// case without tripping over vi.mock/vi.hoisted hoisting order.
// ---------------------------------------------------------------------------

vi.mock('node:net', async () => ({
  Socket: (await import('./__mocks__/smtp.fixtures')).MockSocket,
}));

vi.mock('node:tls', async () => {
  const fixtures = await import('./__mocks__/smtp.fixtures');
  return {
    connect: (_opts: unknown, cb: () => void) => {
      const secure = new fixtures.MockSocket();
      if (fixtures.smtpState.mode === 'tls-error') {
        setTimeout(
          () => secure.emit('error', new Error('wrong version number')),
          0,
        );
        return secure;
      }
      setTimeout(() => cb(), 0);
      return secure;
    },
  };
});

vi.mock('node:dns/promises', () => ({
  resolveMx: vi.fn(
    async () => (await import('./__mocks__/smtp.fixtures')).smtpState.mx,
  ),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TlsScanner', () => {
  const scanner = new TlsScanner();

  beforeEach(() => {
    vi.clearAllMocks();
    smtpState.mode = 'happy';
    smtpState.mx = [{ priority: 10, exchange: 'mx.example.com' }];
    smtpState.cert = {
      valid_to: '2099-01-01T00:00:00.000Z',
      subject: { CN: 'mx.example.com' },
      issuer: { CN: 'ca.example.com' },
      raw: 'cert-bytes',
    };
    smtpState.protocol = 'TLSv1.2';
    smtpState.cipher = { name: 'AES256-GCM-SHA384' };
  });

  // --- Success path ---

  it('PASS when STARTTLS negotiation and certificate are healthy', async () => {
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(true);
    expect(result.scoreWeight).toBe(0);
    expect(result.flags).toEqual([]);
    expect(result.rawData).toMatchObject({
      protocol: 'TLSv1.2',
      cipher: 'AES256-GCM-SHA384',
    });
  });

  it('uses a preset MX and skips self-resolution when provided', async () => {
    const dnsMod = await import('node:dns/promises');
    const resolveMx = vi.mocked(dnsMod.resolveMx);

    await scanner.execute('example.com', 'mx.preset.example.com');
    expect(resolveMx).not.toHaveBeenCalled();
  });

  // --- Error / failure paths ---

  it('FAIL with CERT_EXPIRED when the certificate has expired', async () => {
    smtpState.cert = {
      valid_to: '2020-01-01T00:00:00.000Z',
      subject: { CN: 'mx.example.com' },
      issuer: { CN: 'ca.example.com' },
      raw: 'cert-bytes',
    };
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toContain('CERT_EXPIRED');
    expect(result.error).toContain('expired');
  });

  it('FAIL with WEAK_TLS when an insecure protocol is negotiated', async () => {
    smtpState.protocol = 'TLSv1';
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(20);
    expect(result.flags).toContain('WEAK_TLS');
    expect(result.error).toContain('TLSv1');
  });

  it('flags SELF_SIGNED_CERT when subject CN equals issuer CN', async () => {
    smtpState.cert = {
      valid_to: '2099-01-01T00:00:00.000Z',
      subject: { CN: 'mx.example.com' },
      issuer: { CN: 'mx.example.com' },
      raw: 'self-signed',
    };
    const result = await scanner.execute('example.com');

    // Self-signed is a flag only — the scanner still passes unless the cert
    // is expired or the protocol is weak.
    expect(result.passed).toBe(true);
    expect(result.flags).toContain('SELF_SIGNED_CERT');
  });

  it('FAIL with NO_CERTIFICATE when no certificate is presented', async () => {
    smtpState.cert = {
      subject: { CN: 'mx.example.com' },
      issuer: { CN: 'ca.example.com' },
    };
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.flags).toEqual(['NO_CERTIFICATE']);
  });

  it('FAIL with SOCKET_ERROR when the port is unreachable', async () => {
    smtpState.mode = 'socket-error';
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.flags).toEqual(['SOCKET_ERROR']);
    expect(result.error).toContain('ECONNREFUSED');
  });

  it('FAIL with SMTP_ERROR when EHLO is rejected by the server', async () => {
    smtpState.mode = 'ehlo-fail';
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.flags).toEqual(['SMTP_ERROR']);
    expect(result.error).toContain('SMTP server error');
  });

  it('FAIL with NO_STARTTLS when the server does not support STARTTLS', async () => {
    smtpState.mode = 'no-starttls';
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.flags).toEqual(['NO_STARTTLS']);
    expect(result.error).toContain('STARTTLS');
  });

  it('FAIL with TLS_UPGRADE_FAIL when the TLS handshake fails', async () => {
    smtpState.mode = 'tls-error';
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.flags).toEqual(['TLS_UPGRADE_FAIL']);
    expect(result.error).toContain('TLS Upgrade failed');
  });

  it('FAIL with SKIPPED_NO_MX when no MX record exists', async () => {
    smtpState.mx = [];
    const result = await scanner.execute('example.com');

    expect(result.passed).toBe(false);
    expect(result.scoreWeight).toBe(0);
    expect(result.flags).toEqual(['SKIPPED_NO_MX']);
    expect(result.error).toContain('No MX record');
  });
});
