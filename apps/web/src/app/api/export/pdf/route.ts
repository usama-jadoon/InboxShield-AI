/**
 * @file V1-10: GET /api/export/pdf — real PDF export of a scan report.
 *
 * Workspace-scoped: session auth → workspace resolve → domain ownership
 * check → fetch a specific ScanReport (by scanId) or the latest for the
 * domain → render the immutable ReportModel snapshot to a real PDF.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  prisma,
  ScanService,
  WorkspaceService,
} from '@inboxshield/db';
import { sessionCookieName } from '@/lib/session';
import { generateReportPdf } from '@/lib/export/pdf';
import type { ReportModel } from '@inboxshield/engine';

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

  // 4. Resolve the target scan: by explicit scanId, else latest for domain.
  const scanId = url.searchParams.get('scanId') ?? '';
  const scan = scanId
    ? await ScanService.getById(prisma, domain.id, scanId)
    : await ScanService.getLatestForDomain(prisma, domain.id);
  if (!scan) {
    return NextResponse.json(
      { error: 'Scan report not found for this domain' },
      { status: 404 },
    );
  }

  // 5. Render the immutable evidence snapshot to a real PDF.
  try {
    const reportModel = scan.reportModel as unknown as ReportModel;
    const pdfBuffer = await generateReportPdf(reportModel);

    const filename = `inboxshield-${domain.domainName}-report.pdf`;
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    });
  } catch {
    // Never leak internal error details (P0-08).
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
