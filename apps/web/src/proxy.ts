/**
 * @file Next.js 16 proxy — Node.js runtime route protection (AC-01).
 *
 * Next.js 16 renamed `middleware.ts` → `proxy.ts` and proxy runs on the Node.js
 * runtime by default, which is required for Prisma DB access.  Legacy
 * `middleware.ts` runs on the Edge runtime where PrismaClient is unavailable, so
 * this file MUST be named `proxy.ts`.
 *
 * Session validation is fail-closed: if the DB is unreachable, unauthenticated
 * requests are never let through.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import {
  sessionCookieName,
  validateSessionToken,
} from "./lib/session"

// ---------------------------------------------------------------------------
// Matcher — protect everything except auth and static assets
// ---------------------------------------------------------------------------

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function proxy(
  request: NextRequest,
): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  const token = request.cookies.get(sessionCookieName())?.value ?? ""
  const authenticated = await validateSessionToken(token)

  if (authenticated) {
    return NextResponse.next()
  }

  // API routes → 401; page routes → redirect to /login
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = "/login"
  loginUrl.search = ""
  return NextResponse.redirect(loginUrl)
}
