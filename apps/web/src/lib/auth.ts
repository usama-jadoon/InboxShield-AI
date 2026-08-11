/**
 * @file V1-01: Real authentication — NextAuth v4 config (AC-01).
 *
 * OAuth (Google / GitHub) via NextAuth v4 with DB-backed sessions (PrismaAdapter).
 * Providers are enabled only when the corresponding environment variables are
 * present and non-empty, so no credentials are ever hardcoded (security rule).
 * When no provider is configured, `isAuthConfigured()` returns false and the
 * auth route / login page renders a truthful "not configured" state.
 */

import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "@inboxshield/db"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the value only when non-empty, otherwise undefined. */
function envNonEmpty(key: string): string | undefined {
  const value = process.env[key]
  return value && value.length > 0 ? value : undefined
}

/** OAuth provider IDs this app can enable from environment variables. */
export type ConfiguredProviderId = "google" | "github"

/**
 * Provider IDs that are fully configured (both client id and secret present).
 * Drives both the NextAuth provider list and the login page's button set, so
 * the UI never advertises a provider the auth route cannot serve.
 */
export function getConfiguredProviderIds(): ConfiguredProviderId[] {
  const ids: ConfiguredProviderId[] = []
  if (envNonEmpty("GOOGLE_CLIENT_ID") && envNonEmpty("GOOGLE_CLIENT_SECRET")) ids.push("google")
  if (envNonEmpty("GITHUB_CLIENT_ID") && envNonEmpty("GITHUB_CLIENT_SECRET")) ids.push("github")
  return ids
}

function buildProviders(): NextAuthOptions["providers"] {
  const providers: NonNullable<NextAuthOptions["providers"]> = []
  for (const id of getConfiguredProviderIds()) {
    if (id === "google") {
      providers.push(
        GoogleProvider({
          clientId: envNonEmpty("GOOGLE_CLIENT_ID")!,
          clientSecret: envNonEmpty("GOOGLE_CLIENT_SECRET")!,
        }),
      )
    } else if (id === "github") {
      providers.push(
        GitHubProvider({
          clientId: envNonEmpty("GITHUB_CLIENT_ID")!,
          clientSecret: envNonEmpty("GITHUB_CLIENT_SECRET")!,
        }),
      )
    }
  }
  return providers
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** True when at least one OAuth provider is configured from environment. */
export function isAuthConfigured(): boolean {
  return getConfiguredProviderIds().length > 0
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  // Adapter present → NextAuth forces "database" regardless of this setting,
  // but declaring it explicitly makes the contract visible in source.
  session: { strategy: "database" },
  providers: buildProviders(),
  pages: {
    signIn: "/login",
  },
}
