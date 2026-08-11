/**
 * @file V1-02: GET + POST /api/domains — workspace-scoped domain CRUD (AC-02).
 *
 * Workspace resolution: reads the session cookie (already validated by the
 * proxy) and resolves the user's workspace via session → WorkspaceMember →
 * Workspace.  Returns 403 when no workspace is assigned.  Domain operations
 * are fully scoped by workspaceId at the query layer (DomainService).
 *
 * Rate limiting is deferred to V1-06 (RedisRateLimiter).
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  prisma,
  DomainService,
  DomainError,
  WorkspaceService,
} from '@inboxshield/db';
import { sessionCookieName } from '@/lib/session';
import { validateDomainInput } from '@/lib/domain-validator';

async function resolveWorkspace(req: NextRequest) {
  const token = req.cookies.get(sessionCookieName())?.value ?? '';
  if (!token) return null;
  return WorkspaceService.resolveForSession(prisma, token);
}

export async function GET(req: NextRequest) {
  try {
    const workspace = await resolveWorkspace(req);
    if (!workspace) {
      return NextResponse.json(
        { error: 'No workspace is assigned to this account' },
        { status: 403 },
      );
    }

    const domains = await DomainService.list(prisma, workspace.id);
    return NextResponse.json({ data: domains });
  } catch {
    return NextResponse.json(
      { error: 'Failed to list domains' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const workspace = await resolveWorkspace(req);
    if (!workspace) {
      return NextResponse.json(
        { error: 'No workspace is assigned to this account' },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 },
      );
    }

    const domainName = (body as Record<string, unknown>)?.domain;
    const validation = validateDomainInput(
      typeof domainName === 'string' ? domainName : '',
    );
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const domain = await DomainService.create(prisma, {
      workspaceId: workspace.id,
      domainName: validation.normalized,
    });

    return NextResponse.json({ data: domain }, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof DomainError && e.code === 'DUPLICATE_DOMAIN') {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: 'Failed to create domain' },
      { status: 500 },
    );
  }
}
