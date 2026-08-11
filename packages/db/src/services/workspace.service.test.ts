/**
 * @file V1-02: WorkspaceService session → workspace resolution tests (AC-02).
 *
 * Exercises the two-step lookup (session → membership → workspace) with a
 * mocked PrismaClient.  No live database is required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkspaceService } from './workspace.service';
import type { PrismaClient } from '@prisma/client';

// --- Mock shape ---------------------------------------------------

const findUniqueSession = vi.fn();
const findFirstMembership = vi.fn();

const mockPrisma = {
  session: { findUnique: findUniqueSession },
  workspaceMember: { findFirst: findFirstMembership },
} as unknown as PrismaClient;

const SESSION_TOKEN = 'tok-abc';
const USER_ID = 'u1';
const WORKSPACE = {
  id: 'ws-1',
  name: 'Acme',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

// --- Tests --------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('WorkspaceService.resolveForSession', () => {
  it('returns the first workspace for a valid session with memberships', async () => {
    findUniqueSession.mockResolvedValue({ userId: USER_ID });
    findFirstMembership.mockResolvedValue({ workspace: WORKSPACE });

    const result = await WorkspaceService.resolveForSession(
      mockPrisma,
      SESSION_TOKEN,
    );

    expect(findUniqueSession).toHaveBeenCalledWith({
      where: { sessionToken: SESSION_TOKEN },
      select: { userId: true },
    });
    expect(findFirstMembership).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      orderBy: { createdAt: 'asc' },
      select: { workspace: true },
    });
    expect(result).toEqual(WORKSPACE);
  });

  it('returns null when the session token does not exist', async () => {
    findUniqueSession.mockResolvedValue(null);

    const result = await WorkspaceService.resolveForSession(
      mockPrisma,
      'missing-token',
    );

    expect(result).toBeNull();
    expect(findFirstMembership).not.toHaveBeenCalled();
  });

  it('returns null when the user has no workspace memberships', async () => {
    findUniqueSession.mockResolvedValue({ userId: USER_ID });
    findFirstMembership.mockResolvedValue(null);

    const result = await WorkspaceService.resolveForSession(
      mockPrisma,
      SESSION_TOKEN,
    );

    expect(result).toBeNull();
  });

  it('propagates DB errors (fail-closed — never returns a workspace)', async () => {
    findUniqueSession.mockRejectedValue(new Error('DB unreachable'));

    await expect(
      WorkspaceService.resolveForSession(mockPrisma, SESSION_TOKEN),
    ).rejects.toThrow('DB unreachable');
  });
});
