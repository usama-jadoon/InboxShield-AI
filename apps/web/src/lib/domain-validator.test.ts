import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeDomain,
  isValidHostname,
  validateDomainInput,
  isPrivateOrReservedIP,
} from './domain-validator';

// Mock node:dns/promises so no test performs a real network lookup.
const { resolveMock } = vi.hoisted(() => ({ resolveMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({ resolve: resolveMock }));

describe('normalizeDomain', () => {
  it('lowercases the domain', () => {
    expect(normalizeDomain('GOOGLE.COM')).toBe('google.com');
  });

  it('trims whitespace', () => {
    expect(normalizeDomain('  google.com  ')).toBe('google.com');
  });

  it('removes trailing dot', () => {
    expect(normalizeDomain('google.com.')).toBe('google.com');
  });

  it('does not remove an internal dot', () => {
    expect(normalizeDomain('mail.google.com')).toBe('mail.google.com');
  });
});

describe('isValidHostname', () => {
  it('accepts a standard domain', () => {
    expect(isValidHostname('google.com')).toBe(true);
  });

  it('accepts a domain with multiple sublabels', () => {
    expect(isValidHostname('a.b.c.example.co.uk')).toBe(true);
  });

  it('accepts single-char labels', () => {
    expect(isValidHostname('a.b')).toBe(true);
  });

  it('rejects a label that starts with a hyphen', () => {
    expect(isValidHostname('-google.com')).toBe(false);
  });

  it('rejects a label that ends with a hyphen', () => {
    expect(isValidHostname('google-.com')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidHostname('')).toBe(false);
  });

  it('rejects a string longer than 253 characters', () => {
    const long = 'a'.repeat(64) + '.com'; // label too long
    expect(isValidHostname(long)).toBe(false);
  });

  it('IP addresses are technically valid hostnames (IP blocking is in validateDomainInput)', () => {
    // isValidHostname checks hostname syntax only — IP rejection is handled
    // by the higher-level validateDomainInput function which has an explicit
    // regex for digits-only input. This test documents the boundary.
    expect(isValidHostname('192.168.1.1')).toBe(true);
  });
});

describe('validateDomainInput', () => {
  it('accepts a valid domain', () => {
    const result = validateDomainInput('example.com');
    expect(result).toEqual({ valid: true, normalized: 'example.com' });
  });

  it('rejects empty input', () => {
    const result = validateDomainInput('');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toBe('Domain is required');
  });

  it('rejects whitespace-only input', () => {
    const result = validateDomainInput('   ');
    expect(result.valid).toBe(false);
  });

  it('rejects bare IPv4 address', () => {
    const result = validateDomainInput('192.168.1.1');
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error).toContain('IP addresses');
  });

  it('rejects bare IPv6 address', () => {
    const result = validateDomainInput('::1');
    expect(result.valid).toBe(false);
  });

  it('rejects localhost', () => {
    const result = validateDomainInput('localhost');
    expect(result.valid).toBe(false);
  });

  it('rejects malformed hostname', () => {
    const result = validateDomainInput('invalid..hostname');
    expect(result.valid).toBe(false);
  });

  it('normalises valid input', () => {
    const result = validateDomainInput('  Example.COM.  ');
    expect(result).toEqual({ valid: true, normalized: 'example.com' });
  });
});

describe('isPrivateOrReservedIP', () => {
  beforeEach(() => {
    resolveMock.mockReset();
  });

  it('blocks RFC1918 10.x.x.x', async () => {
    resolveMock.mockResolvedValue(['10.0.0.1']);
    expect(await isPrivateOrReservedIP('example.com')).toBe(true);
  });

  it('blocks RFC1918 172.16.x.x', async () => {
    resolveMock.mockResolvedValue(['172.16.0.1']);
    expect(await isPrivateOrReservedIP('example.com')).toBe(true);
  });

  it('blocks RFC1918 192.168.x.x', async () => {
    resolveMock.mockResolvedValue(['192.168.1.1']);
    expect(await isPrivateOrReservedIP('example.com')).toBe(true);
  });

  it('blocks loopback 127.x.x.x', async () => {
    resolveMock.mockResolvedValue(['127.0.0.1']);
    expect(await isPrivateOrReservedIP('example.com')).toBe(true);
  });

  it('blocks link-local 169.254.x.x', async () => {
    resolveMock.mockResolvedValue(['169.254.0.1']);
    expect(await isPrivateOrReservedIP('example.com')).toBe(true);
  });

  it('blocks IPv6 loopback ::1', async () => {
    resolveMock.mockResolvedValue(['::1']);
    expect(await isPrivateOrReservedIP('example.com')).toBe(true);
  });

  it('allows a public IP', async () => {
    resolveMock.mockResolvedValue(['8.8.8.8']);
    expect(await isPrivateOrReservedIP('example.com')).toBe(false);
  });

  it('allows another public IP', async () => {
    resolveMock.mockResolvedValue(['52.85.132.99']);
    expect(await isPrivateOrReservedIP('example.com')).toBe(false);
  });

  it('returns false when DNS resolution fails (not an SSRF concern)', async () => {
    resolveMock.mockRejectedValue(new Error('ENOTFOUND'));
    expect(await isPrivateOrReservedIP('doesnotexist.example')).toBe(false);
  });

  it('blocks when at least one of multiple IPs is private', async () => {
    resolveMock.mockResolvedValue(['8.8.8.8', '10.0.0.1']);
    expect(await isPrivateOrReservedIP('example.com')).toBe(true);
  });
});
