import * as net from 'node:net';
import * as tls from 'node:tls';
import * as dns from 'node:dns/promises';
export class TlsScanner {
    id = 'network:smtp:tls';
    description = 'Validates SMTP STARTTLS support, TLS version, cipher, and certificate expiry on the primary MX.';
    async execute(domain, presetMx) {
        let mxRecord = presetMx;
        // Self-resolve MX if the orchestrator did not chain it
        if (!mxRecord) {
            try {
                const records = await dns.resolveMx(domain);
                if (records.length > 0) {
                    mxRecord = records.sort((a, b) => a.priority - b.priority)[0].exchange;
                }
            }
            catch (err) {
                // Do nothing, mxRecord remains undefined
            }
        }
        if (!mxRecord) {
            return {
                scannerId: this.id,
                passed: false,
                scoreWeight: 0,
                rawData: null,
                error: "Cannot perform TLS scan: No MX record physically exists.",
                flags: ['SKIPPED_NO_MX']
            };
        }
        return new Promise((resolve) => {
            let resolved = false;
            const finish = (result) => {
                if (resolved)
                    return;
                resolved = true;
                clearTimeout(timeout);
                if (socket && !socket.destroyed)
                    socket.destroy();
                resolve({
                    scannerId: this.id,
                    passed: result.passed ?? false,
                    scoreWeight: result.scoreWeight ?? 20,
                    rawData: result.rawData || null,
                    error: result.error,
                    flags: result.flags || []
                });
            };
            const socket = new net.Socket();
            let state = 'CONNECTING';
            const timeout = setTimeout(() => {
                finish({ passed: false, error: `SMTP connection timed out at state: ${state}`, flags: ['SMTP_TIMEOUT'] });
            }, 5000);
            let buffer = '';
            socket.on('data', (data) => {
                buffer += data.toString('utf-8');
                const lines = buffer.split('\r\n');
                while (lines.length > 1) {
                    const line = lines.shift() || '';
                    if (state === 'CONNECTING' && line.startsWith('220')) {
                        state = 'EHLO';
                        socket.write(`EHLO inboxshield.ai\r\n`);
                    }
                    else if (state === 'EHLO' && (line.startsWith('250 ') || line.startsWith('250-'))) {
                        // Wait until the end of the EHLO response list
                        if (line.startsWith('250 ')) {
                            state = 'STARTTLS';
                            socket.write(`STARTTLS\r\n`);
                        }
                    }
                    else if (state === 'STARTTLS' && line.startsWith('220')) {
                        state = 'UPGRADING';
                        const secureSocket = tls.connect({
                            socket,
                            servername: mxRecord,
                            rejectUnauthorized: false // We evaluate manually to catch exact errors rather than throwing generic errors
                        }, () => {
                            const cert = secureSocket.getPeerCertificate(false);
                            const protocol = secureSocket.getProtocol();
                            const cipher = secureSocket.getCipher();
                            if (!cert || (!cert.valid_to && !cert.raw)) {
                                return finish({ passed: false, error: 'No certificate presented during STARTTLS handhshake.', flags: ['NO_CERTIFICATE'] });
                            }
                            let daysRemaining = 999;
                            let isExpired = false;
                            if (cert.valid_to) {
                                const validTo = new Date(cert.valid_to).getTime();
                                daysRemaining = Math.floor((validTo - Date.now()) / (1000 * 60 * 60 * 24));
                                isExpired = daysRemaining < 0;
                            }
                            const isWeakTls = protocol === 'TLSv1' || protocol === 'TLSv1.1' || protocol === 'SSLv3';
                            let passed = true;
                            let errorStr = '';
                            const flags = [];
                            if (isExpired) {
                                passed = false;
                                errorStr = `Certificate expired ${Math.abs(daysRemaining)} days ago.`;
                                flags.push('CERT_EXPIRED');
                            }
                            if (isWeakTls) {
                                passed = false;
                                errorStr += (errorStr ? ' ' : '') + `Weak TLS protocol detected (${protocol}).`;
                                flags.push('WEAK_TLS');
                            }
                            if (daysRemaining >= 0 && daysRemaining < 14) {
                                flags.push('CERT_EXPIRING_SOON');
                            }
                            // Simplistic self-signed check
                            if (cert.subject.CN === cert.issuer.CN) {
                                flags.push('SELF_SIGNED_CERT');
                            }
                            secureSocket.write(`QUIT\r\n`);
                            finish({
                                passed,
                                scoreWeight: passed ? 0 : 20,
                                rawData: { protocol, cipher: cipher.name, daysRemaining, validTo: cert.valid_to, issuer: cert.issuer?.O },
                                error: errorStr || undefined,
                                flags
                            });
                        });
                        secureSocket.on('error', (err) => {
                            finish({ passed: false, error: `TLS Upgrade failed: ${err.message}`, flags: ['TLS_UPGRADE_FAIL'] });
                        });
                    }
                    else if (line.match(/^[45]\d\d/)) {
                        // Example edge case: Server does not support STARTTLS
                        if (state === 'STARTTLS' && line.startsWith('502')) {
                            finish({ passed: false, error: `SMTP server does not support STARTTLS upgrade.`, flags: ['NO_STARTTLS'] });
                        }
                        else {
                            finish({ passed: false, error: `SMTP server error: ${line}`, flags: ['SMTP_ERROR'] });
                        }
                    }
                }
                buffer = lines[0];
            });
            socket.on('error', (err) => {
                finish({ passed: false, error: `Socket error: ${err.message}`, flags: ['SOCKET_ERROR'] });
            });
            socket.connect(25, mxRecord);
        });
    }
}
