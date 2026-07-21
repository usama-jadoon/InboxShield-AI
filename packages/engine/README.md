# @inboxshield/engine

A framework-agnostic, plugin-based email deliverability and infrastructure scanner.

## Philosophy
The engine executes entirely locally (executing direct DNS and SMTP handshakes over physical ports). It accepts a domain and orchestrates a series of modular test plugins, returning a highly normalized `EngineReport` which contains deterministic scoring and standardized capability flags.

It is completely agnostic. It does not know about Prisma, PostgreSQL, Next.js, or Fastify. It simply takes a domain String and returns JSON.

## Supported Plugins
- `DnsScanner`: Verifies raw A/AAAA resolution.
- `SpfScanner`: Verifies valid RFC 7208 syntax and policies.
- `DmarcScanner`: Evaluates DMARC record positioning and strictness.
- `MxScanner`: Maps MX endpoints and detects RFC Null-MX behavior.
- `TlsScanner`: Performs active TLS connection testing against the target mailserver to verify certificate validity.
- `BlacklistScanner`: Concurrently hits multi.surbl.org and Spamhaus DBL.

## Adding a Plugin
Implement the `BaseScanner` interface. The `EngineOrchestrator` will handle safely wrapping your `execute()` function to ensure a single crash doesn't halt the entire system sweep.
