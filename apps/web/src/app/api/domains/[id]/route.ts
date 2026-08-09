/**
 * @file V1-02: DELETE /api/domains/:id — workspace-scoped domain deletion (AC-02).
 *
 * Workspace-scoped delete via DomainService.remove.  Returns 204 on success,
 * 404 when the domain is missing or not in the authenticated workspace.
 * Proxy already enforces session auth; the route validates workspace membership.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  prisma,
  DomainService,
  DomainError,
  WorkspaceService,
} from '@inboxshield/db';
import { sessionCookieName } from '@/lib/session';

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  try {
    const token = req.cookies.get(sessionCookieName())?.value ?? '';
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const workspace = await WorkspaceService.resolveForSession(prisma, token);
    if (!workspace) {
      return NextResponse.json(
        { error: 'No workspace is assigned to this account' },
        { status: 403 },
      );
    }

    await DomainService.remove(prisma, workspace.id, id);
    return new NextResponse(null, { status: 204 });
  } catch (e: unknown) {
    if (e instanceof DomainError && e.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Domain not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Failed to delete domain' },
      { status: 500 },
    );
  }
}
