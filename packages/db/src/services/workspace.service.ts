/**
 * @file V1-02: workspace resolution from session token (AC-02).
 *
 * Resolves the workspace for a request by walking session → user →
 * WorkspaceMember → Workspace.  V1 single-workspace assumption: returns the
 * user's first membership (oldest workspace).  Returns `null` when the token
 * does not match a session or the user has no workspace membership.
 */
import type { PrismaClient, Workspace } from '@prisma/client';

export class WorkspaceService {
  static async resolveForSession(
    db: PrismaClient,
    sessionToken: string,
  ): Promise<Workspace | null> {
    const session = await db.session.findUnique({
      where: { sessionToken },
      select: { userId: true },
    });
    if (!session) return null;

    const membership = await db.workspaceMember.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: 'asc' },
      select: { workspace: true },
    });
    return membership?.workspace ?? null;
  }
}
