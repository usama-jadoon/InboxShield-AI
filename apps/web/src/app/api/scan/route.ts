import { NextResponse } from 'next/server';
import {
  EngineOrchestrator,
  DnsScanner,
  SpfScanner,
  DkimScanner,
  DmarcScanner,
  MxScanner,
  TlsScanner,
  BlacklistScanner,
  HeuristicAiProvider
} from '@inboxshield/engine';
import { validateDomainInput, isPrivateOrReservedIP } from '@/lib/domain-validator';
import { RateLimiter, LocalMemoryRateLimiter } from '@/lib/rate-limit';

const orchestrator = new EngineOrchestrator();
orchestrator.registerScanner(new DnsScanner());
orchestrator.registerScanner(new SpfScanner());
orchestrator.registerScanner(new DkimScanner());
orchestrator.registerScanner(new DmarcScanner());
orchestrator.registerScanner(new MxScanner());
orchestrator.registerScanner(new TlsScanner());
orchestrator.registerScanner(new BlacklistScanner());

const aiProvider = new HeuristicAiProvider();

/**
 * Rate limiter instance.
 * Phase 0: LocalMemoryRateLimiter — single-process, non-persistent, dev-only.
 * Phase 1: swap for RedisRateLimiter (same interface, Redis-backed).
 * The route imports the RateLimiter *interface*, not the concrete class, so
 * swapping implementations is a one-line dependency change.
 */
const rateLimiter: RateLimiter = new LocalMemoryRateLimiter();

const SCAN_TIMEOUT_MS = 30_000;

export async function POST(req: Request) {
  let domain: string | undefined;
  try {
    const body = await req.json();
    domain = body.domain;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 1. Domain format validation + normalisation
  const validation = validateDomainInput(domain ?? '');
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const normalizedDomain = validation.normalized;

  // 2. SSRF defence — block RFC1918 / loopback / link-local IPs
  const blocked = await isPrivateOrReservedIP(normalizedDomain);
  if (blocked) {
    return NextResponse.json(
      { error: 'Domain resolves to a private or reserved IP address' },
      { status: 400 }
    );
  }

  // 3. Per-domain rate limiting (keyed on normalised domain)
  const rateLimitResult = await rateLimiter.check(normalizedDomain);
  if (!rateLimitResult.allowed) {
    const response = NextResponse.json(
      { error: 'Rate limit exceeded — try again later' },
      { status: 429 }
    );
    response.headers.set('Retry-After', String(rateLimitResult.retryAfterSeconds ?? 60));
    return response;
  }

  // 4. Scan with 30s total timeout and safe error handling
  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Scan timed out')), SCAN_TIMEOUT_MS);
    });

    const report = await Promise.race([
      orchestrator.analyzeDomain(normalizedDomain),
      timeoutPromise,
    ]);
    const recommendations = await aiProvider.analyze(report);

    const response = NextResponse.json({ report, recommendations });
    if (rateLimitResult.remaining !== undefined) {
      response.headers.set('X-RateLimit-Remaining', String(rateLimitResult.remaining));
    }
    return response;
  } catch {
    // Never leak error.message — return a generic message only.
    return NextResponse.json({ error: 'Scan failed' }, { status: 500 });
  }
}
