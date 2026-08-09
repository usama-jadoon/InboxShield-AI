/**
 * @file DB-backed session validation helpers for route protection (AC-01).
 *
 * Cookie name mirrors NextAuth v4's `useSecureCookies` default.
 * The token → session lookup is injectable so tests can avoid a real DB.
 */

import { prisma } from "@inboxshield/db"

// ---------------------------------------------------------------------------
// Cookie name
// ---------------------------------------------------------------------------

/** NextAuth v4 cookie name, production-secure vs dev-plain. */
export function sessionCookieName(): string {
  const url = process.env.NEXTAUTH_URL ?? "http://localhost:3000"
  return url.startsWith("https://")
    ? "__Secure-next-auth.session-token"
    : "next-auth.session-token"
}

// ---------------------------------------------------------------------------
// Session lookup (injectable for testing)
// ---------------------------------------------------------------------------

export interface SessionLookupResult {
  expires: Date
}

export type SessionLookup = (token: string) => Promise<SessionLookupResult | null>

/**
 * Production lookup: queries the Session table via Prisma.
 * Returns the raw row so the caller controls expiry checking.
 */
export const dbSessionLookup: SessionLookup = (token) =>
  prisma.session
    .findUnique({ where: { sessionToken: token } })
    .then((row) => (row ? { expires: row.expires } : null))

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

/**
 * Returns `true` only when `token` maps to a Session row whose expiry is in
 * the future.  Fail-closed: any lookup error (DB unavailable, etc.) yields
 * `false` so unauthenticated requests are never let through.
 */
export async function validateSessionToken(
  token: string,
  lookup: SessionLookup = dbSessionLookup,
): Promise<boolean> {
  if (!token) return false
  try {
    const session = await lookup(token)
    if (!session) return false
    return session.expires.getTime() > Date.now()
  } catch {
    return false
  }
}
