import * as dns from 'node:dns/promises';

// RFC-compliant hostname regex: labels 2-63 chars, hyphens allowed (not at start/end),
// total ≤ 253 chars, must have at least two labels.
const HOSTNAME_RE = /^(?!-)[A-Za-z0-9-]{1,63}(?<!-)(\.[A-Za-z0-9-]{1,63}(?<!-))+$/;

/**
 * Private / reserved IPv4 and IPv6 ranges (RFC1918, loopback, link-local, etc.)
 * Any domain whose A record resolves to one of these is blocked from scanning.
 */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,                          // loopback
  /^10\./,                           // RFC1918
  /^172\.(1[6-9]|2\d|3[01])\./,    // RFC1918
  /^192\.168\./,                     // RFC1918
  /^169\.254\./,                     // link-local
  /^0\./,                            // "this network"
  /^::1$/i,                          // IPv6 loopback
  /^fc/i,                            // IPv6 ULA
  /^fd/i,                            // IPv6 ULA
  /^fe80/i,                          // IPv6 link-local
];

function isPrivateIP(ip: string): boolean {
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ip));
}

/**
 * Normalise domain input: lowercase, trim whitespace, strip trailing dot.
 */
export function normalizeDomain(input: string): string {
  return input.trim().toLowerCase().replace(/\.$/, '');
}

/**
 * Validate that a string is an RFC-compliant hostname (after normalisation).
 */
export function isValidHostname(hostname: string): boolean {
  if (hostname.length === 0 || hostname.length > 253) return false;
  return HOSTNAME_RE.test(hostname);
}

/**
 * Validate and normalise user-supplied domain input.
 * Returns { valid: true, normalized } or { valid: false, error }.
 */
export function validateDomainInput(
  raw: string
): { valid: true; normalized: string } | { valid: false; error: string } {
  if (typeof raw !== 'string') {
    return { valid: false, error: 'Domain must be a string' };
  }
  const normalized = normalizeDomain(raw);
  if (normalized.length === 0) {
    return { valid: false, error: 'Domain is required' };
  }
  // Reject bare IP addresses (contain digits but no alpha, or match IP pattern)
  if (/^[\d.:]+$/.test(normalized)) {
    return { valid: false, error: 'IP addresses are not accepted — supply a domain name' };
  }
  if (!isValidHostname(normalized)) {
    return { valid: false, error: 'Invalid domain format' };
  }
  return { valid: true, normalized };
}

/**
 * Resolve the domain's A records and return true if any resolved IP is in a
 * private/reserved range.  Returns true → caller must block the scan.
 *
 * This is intentionally a lightweight check: it resolves the domain A records
 * and checks each IP.  It uses the standard Node DNS resolver (node:dns/promises)
 * which is suitable for SSRF defence in a Next.js API route.
 */
export async function isPrivateOrReservedIP(domain: string): Promise<boolean> {
  try {
    const records = await dns.resolve(domain, 'A');
    return records.some((ip) => isPrivateIP(ip));
  } catch {
    // DNS resolution failure is not an SSRF concern — report false so the
    // caller sees the resolution error downstream (scanner).
    return false;
  }
}
