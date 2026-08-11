/**
 * @file V1-02: DomainService workspace-scoped CRUD tests (AC-02).
 *
 * Uses a plain mock object shaped like PrismaClient — no real database
 * required.  Tests verify workspace scoping at the query layer and the
 * DomainError contract.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DomainService, DomainError } from './domain.service';
import type { PrismaClient } from '@prisma/client';

// --- Mock shape ---------------------------------------------------

const mockPrisma = {
  domain: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    delete: vi.fn(),
  },
} as unknown as PrismaClient;

const WORKSPACE_ID = 'ws-1';
const DOMAIN_NAME = 'example.com';
const DOMAIN_ID = 'dom-1';
const NOW = new Date('2026-08-09T00:00:00Z');

function fakeDomain(overrides: Record<string, unknown> = {}) {
  return {
    id: DOMAIN_ID,
    domainName: DOMAIN_NAME,
    workspaceId: WORKSPACE_ID,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

// --- Tests --------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DomainService.list', () => {
  it('scopes the query by workspaceId and returns newest first', async () => {
    const rows = [fakeDomain()];
    mockPrisma.domain.findMany = vi.fn().mockResolvedValue(rows);

    const result = await DomainService.list(mockPrisma, WORKSPACE_ID);

    expect(mockPrisma.domain.findMany).toHaveBeenCalledWith({
      where: { workspaceId: WORKSPACE_ID },
      orderBy: { createdAt: 'desc' },
    });
    expect(result).toEqual(rows);
  });
});

describe('DomainService.create', () => {
  it('persists the domain and returns it when the name is unique', async () => {
    mockPrisma.domain.findUnique.mockResolvedValue(null);
    const created = fakeDomain();
    mockPrisma.domain.create.mockResolvedValue(created);

    const result = await DomainService.create(mockPrisma, {
      workspaceId: WORKSPACE_ID,
      domainName: DOMAIN_NAME,
    });

    expect(mockPrisma.domain.findUnique).toHaveBeenCalledWith({
      where: { domainName: DOMAIN_NAME },
    });
    expect(mockPrisma.domain.create).toHaveBeenCalledWith({
      data: { workspaceId: WORKSPACE_ID, domainName: DOMAIN_NAME },
    });
    expect(result).toEqual(created);
  });

  it('throws DUPLICATE_DOMAIN when the name already exists', async () => {
    mockPrisma.domain.findUnique.mockResolvedValue(fakeDomain());

    await expect(
      DomainService.create(mockPrisma, {
        workspaceId: WORKSPACE_ID,
        domainName: DOMAIN_NAME,
      }),
    ).rejects.toSatisfy((e: unknown) =>
      e instanceof DomainError && e.code === 'DUPLICATE_DOMAIN',
    );

    expect(mockPrisma.domain.create).not.toHaveBeenCalled();
  });

  it('does not create when findUnique throws (fail-closed)', async () => {
    mockPrisma.domain.findUnique.mockRejectedValue(new Error('DB down'));

    await expect(
      DomainService.create(mockPrisma, {
        workspaceId: WORKSPACE_ID,
        domainName: DOMAIN_NAME,
      }),
    ).rejects.toThrow('DB down');

    expect(mockPrisma.domain.create).not.toHaveBeenCalled();
  });
});

describe('DomainService.remove', () => {
  it('deletes when the domain belongs to the workspace', async () => {
    mockPrisma.domain.findFirst.mockResolvedValue(fakeDomain());
    mockPrisma.domain.delete.mockResolvedValue(undefined);

    await DomainService.remove(mockPrisma, WORKSPACE_ID, DOMAIN_ID);

    expect(mockPrisma.domain.findFirst).toHaveBeenCalledWith({
      where: { id: DOMAIN_ID, workspaceId: WORKSPACE_ID },
    });
    expect(mockPrisma.domain.delete).toHaveBeenCalledWith({
      where: { id: DOMAIN_ID },
    });
  });

  it('throws NOT_FOUND when the domain does not exist', async () => {
    mockPrisma.domain.findFirst.mockResolvedValue(null);

    await expect(
      DomainService.remove(mockPrisma, WORKSPACE_ID, 'missing'),
    ).rejects.toSatisfy((e: unknown) =>
      e instanceof DomainError && e.code === 'NOT_FOUND',
    );

    expect(mockPrisma.domain.delete).not.toHaveBeenCalled();
  });

  it('throws NOT_FOUND when the domain belongs to a different workspace', async () => {
    mockPrisma.domain.findFirst.mockResolvedValue(null); // not found within this workspace

    await expect(
      DomainService.remove(mockPrisma, WORKSPACE_ID, DOMAIN_ID),
    ).rejects.toSatisfy((e: unknown) =>
      e instanceof DomainError && e.code === 'NOT_FOUND',
    );
  });

  it('propagates DB errors from findFirst (fail-closed)', async () => {
    mockPrisma.domain.findFirst.mockRejectedValue(new Error('connection lost'));

    await expect(
      DomainService.remove(mockPrisma, WORKSPACE_ID, DOMAIN_ID),
    ).rejects.toThrow('connection lost');
  });

  it('propagates DB errors from delete', async () => {
    mockPrisma.domain.findFirst.mockResolvedValue(fakeDomain());
    mockPrisma.domain.delete.mockRejectedValue(new Error('FK violation'));

    await expect(
      DomainService.remove(mockPrisma, WORKSPACE_ID, DOMAIN_ID),
    ).rejects.toThrow('FK violation');
  });
});
