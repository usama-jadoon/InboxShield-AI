"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertCircle, ShieldCheck } from "lucide-react";
import type { ConfiguredProviderId } from "@/lib/auth";

/** Google brand mark (lucide has no brand icons). */
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.19 7.19 0 0 1 0-4.58V6.62H1.29a12.04 12.04 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

/** GitHub brand mark (lucide has no brand icons). */
function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.55 0-.27-.01-1.18-.02-2.14-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11.06 11.06 0 0 1 5.77 0c2.2-1.49 3.16-1.18 3.16-1.18.63 1.59.24 2.76.12 3.05.74.8 1.18 1.83 1.18 3.09 0 4.42-2.7 5.39-5.27 5.68.41.36.78 1.06.78 2.14 0 1.55-.02 2.8-.02 3.18 0 .31.21.67.8.55A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

const PROVIDER_LABELS: Record<ConfiguredProviderId, string> = {
  google: "Google",
  github: "GitHub",
};

/**
 * V1-01: Real authentication — login form (AC-01).
 *
 * Renders one OAuth button per configured provider, delegating to NextAuth's
 * `signIn()` (which handles CSRF internally). When no provider is configured
 * the page states the truth instead of offering dead buttons — mirroring the
 * 503 returned by the auth route.
 */
export function LoginForm({ providers }: { providers: ConfiguredProviderId[] }) {
  const [pending, setPending] = useState<ConfiguredProviderId | null>(null);

  if (providers.length === 0) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-md bg-neutral-800">
            <AlertCircle className="h-6 w-6 text-amber-500" aria-hidden="true" />
          </div>
          <CardTitle>Sign-in is not configured</CardTitle>
          <CardDescription>
            No OAuth provider is enabled on this deployment.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-neutral-400">
          <p className="mb-3">
            Set <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-neutral-300">GOOGLE_CLIENT_ID</code> and{" "}
            <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-neutral-300">GOOGLE_CLIENT_SECRET</code>, or{" "}
            <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-neutral-300">GITHUB_CLIENT_ID</code> and{" "}
            <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-neutral-300">GITHUB_CLIENT_SECRET</code>, then
            restart the server.
          </p>
          <p>
            The <code className="rounded bg-neutral-900 px-1.5 py-0.5 text-neutral-300">/api/auth/*</code> route returns
            503 until then.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSignIn = (provider: ConfiguredProviderId) => {
    setPending(provider);
    // NextAuth handles the CSRF + redirect. After a successful OAuth round-trip
    // the session cookie is set and the proxy lets the callback URL through.
    void signIn(provider, { callbackUrl: "/" });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-neutral-800">
          <ShieldCheck className="h-6 w-6 text-emerald-500" aria-hidden="true" />
        </div>
        <CardTitle className="text-xl">Sign in to InboxShield AI</CardTitle>
        <CardDescription>Continue with your OAuth account to access the dashboard.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {providers.map((provider) => (
          <Button
            key={provider}
            variant="outline"
            className="h-11 w-full gap-3"
            disabled={pending !== null}
            onClick={() => handleSignIn(provider)}
          >
            {provider === "google" ? (
              <GoogleIcon className="h-5 w-5" />
            ) : (
              <GithubIcon className="h-5 w-5" />
            )}
            Continue with {PROVIDER_LABELS[provider]}
            {pending === provider && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-500 border-t-transparent" aria-label="Signing in" />
            )}
          </Button>
        ))}
        <p className="pt-1 text-center text-xs text-neutral-500">
          Your organization controls access. No password is stored by InboxShield.
        </p>
      </CardContent>
    </Card>
  );
}
