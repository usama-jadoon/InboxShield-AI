/**
 * @file V1-01: Real authentication — NextAuth route handler (AC-01).
 *
 * Replaces the hardcoded admin@inboxshield.ai / "test" credentials stub (audit A-1).
 * Uses OAuth providers conditionally configured via environment variables;
 * returns a truthful 503 when no provider is available.
 */

import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { authOptions, isAuthConfigured } from "@/lib/auth"

// Build the handler at module-load time.  With an empty providers array
// NextAuth no longer throws (v4.24+), so this is safe even when no env
// vars are present.
const handler = NextAuth(authOptions)

function notConfigured() {
  return NextResponse.json(
    {
      error:
        "Authentication is not configured. " +
        "Set GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET or " +
        "GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET.",
    },
    { status: 503 },
  )
}

// Next.js 16 passes params as a Promise.  We resolve it before forwarding
// to NextAuth, whose App Router overload expects the raw value.

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ nextauth: string[] }> },
) {
  if (!isAuthConfigured()) return notConfigured()
  const params = await ctx.params
  return handler(req, { params })
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ nextauth: string[] }> },
) {
  if (!isAuthConfigured()) return notConfigured()
  const params = await ctx.params
  return handler(req, { params })
}
