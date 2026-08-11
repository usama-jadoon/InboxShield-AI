import type { Metadata } from "next";
import { getConfiguredProviderIds } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — InboxShield AI",
};

// The provider list depends on runtime environment variables, so never
// statically bake the "not configured" state into the build.
export const dynamic = "force-dynamic";

/**
 * V1-01: Real authentication — login page (AC-01).
 *
 * Server component: reads which OAuth providers are actually configured from
 * environment variables and passes that list to the client form, so the page
 * only ever advertises providers the auth route can serve. Renders a truthful
 * "not configured" state when no OAuth credentials exist — matching the 503
 * the auth route returns.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <LoginForm providers={getConfiguredProviderIds()} />
    </div>
  );
}
