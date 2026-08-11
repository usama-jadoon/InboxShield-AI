import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock heavy dependencies so tests exercise only the env-reading logic.
vi.mock('@inboxshield/db', () => ({ prisma: {} }));
vi.mock('@next-auth/prisma-adapter', () => ({ PrismaAdapter: () => ({}) }));

import { getConfiguredProviderIds, isAuthConfigured } from './auth';

describe('getConfiguredProviderIds', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns an empty list when no OAuth env vars are set', () => {
    expect(getConfiguredProviderIds()).toEqual([]);
  });

  it('enables google when both client id and secret are set', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'gid');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'gsecret');
    expect(getConfiguredProviderIds()).toEqual(['google']);
  });

  it('does not enable google when only the client id is set', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'gid');
    expect(getConfiguredProviderIds()).toEqual([]);
  });

  it('enables github when both client id and secret are set', () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'hid');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'hsecret');
    expect(getConfiguredProviderIds()).toEqual(['github']);
  });

  it('enables both providers when all four env vars are set', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'gid');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'gsecret');
    vi.stubEnv('GITHUB_CLIENT_ID', 'hid');
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'hsecret');
    expect(getConfiguredProviderIds()).toEqual(['google', 'github']);
  });
});

describe('isAuthConfigured', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns false when no provider is configured', () => {
    expect(isAuthConfigured()).toBe(false);
  });

  it('returns true when at least one provider is configured', () => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'gid');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'gsecret');
    expect(isAuthConfigured()).toBe(true);
  });
});
