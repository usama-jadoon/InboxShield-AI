/**
 * @file V1-10: GET /api/export/csv — real CSV export of scan history.
 *
 * Workspace-scoped: session auth → workspace resolve → domain ownership
 * check → ScanService.listByDomain → scanHistoryToCsv. Returns an RFC 4180
 * CSV attachment.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  prisma,
  ScanService,
  WorkspaceService,
} from '@inboxshield/db';
import { sessionCookieName } from '@/lib/session';
import { scanHistoryToCsv } from '@/lib/export/csv';

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

export async function GET(req: NextRequest) {
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
  const url = new URL(req.url);
  const domainId = url.searchParams.get('domainId') ?? '';
  const domain = await prisma.domain.findFirst({
    where: { id: domainId, workspaceId: workspace.id },
  });
  if (!domain) {
    return NextResponse.json(
      { error: 'Domain not found in this workspace' },
      { status: 404 },
    );
  }

  // 4. Parse optional limit query param.
  const rawLimit = parseInt(url.searchParams.get('limit') ?? '', 10);
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(rawLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

  // 5. Fetch scan history (most recent first) and serialize to CSV.
  const reports = await ScanService.listByDomain(prisma, domain.id, limit);
  const csv = scanHistoryToCsv(reports);

  const filename = `inboxshield-${domain.domainName}-history.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
