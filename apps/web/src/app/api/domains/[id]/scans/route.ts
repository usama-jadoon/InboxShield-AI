/**
 * @file V1-04: GET /api/domains/:id/scans — workspace-scoped scan history (AC-03).
 *
 * Returns up to 20 recent ScanReport records for a domain, ordered by
 * createdAt descending.  The domain must be registered in the caller's
 * workspace; otherwise 404.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  prisma,
  ScanService,
  WorkspaceService,
} from '@inboxshield/db';
import { sessionCookieName } from '@/lib/session';

const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 10;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  // 1. Session authentication — fail closed.
  let token: string;
  try {
    token = req.cookies.get(sessionCookieName())?.value ?? '';
  } catch {
    token = '';
  }
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Resolve workspace from session.
  const workspace = await WorkspaceService.resolveForSession(prisma, token);
  if (!workspace) {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  // 3. Verify the domain is registered in the authenticated workspace.
  const domain = await prisma.domain.findFirst({
    where: { id, workspaceId: workspace.id },
  });
  if (!domain) {
    return NextResponse.json(
      { error: 'Domain not found in this workspace' },
      { status: 404 },
    );
  }

  // 4. Parse optional limit query param.
  const url = new URL(req.url);
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  // 5. Fetch scan history.
  const reports = await ScanService.listByDomain(prisma, domain.id, limit);

  return NextResponse.json({ data: reports });
}
