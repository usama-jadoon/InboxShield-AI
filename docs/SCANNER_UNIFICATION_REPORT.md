# Scanner Unification Report

**Version:** 1.0 (Canonical)
**Date:** 2026-08-08
**Status:** Baseline — P0-06 completed

## Summary

This document describes the scanner unification plan for Phase 0, specifically the migration of the IP-RBL scanner from `apps/worker/src/scanners/blacklist.scanner.ts` to the canonical `@inboxshield/engine` library as `IpBlacklistScanner`.

## Current State Analysis

### Worker Blacklist Scanner

**Location:** `apps/worker/src/scanners/blacklist.scanner.ts`

**Capabilities:**
- Checks both domains (DBL scanner) and IP addresses
- 3 tier-1 RBL lists: zen.spamhaus.org, b.barracudacentral.org, bl.spamcop.net
- 1 DBL list: dbl.spamhaus.org
- Uses `DnsScanner.checkARecords()` (worker-local DNS)

**Issues:**
- Not persistence-agnostic (worker-specific)
- Uses node:dns directly, not DoH
- Duplicate scoring logic (different from engine)
- Split domain vs IP functionality

### Canonical Engine Blacklist Scanner

**Location:** `packages/engine/src/scanners/blacklist.scanner.ts`

**Capabilities:**
- Domain-only blacklist check using DoH (Cloudflare)
- 2 DBL lists: dbl.spamhaus.org, multi.surbl.org
- Uses `dns.resolve()` with node:dns (not DoH)
- Returns `ScannerResult` (engine contract)

## Unification Strategy

### P0-06: IP-RBL Migration

Create a new `IpBlacklistScanner` in `packages/engine/src/scanners/` that:

1. **Consolidates IP reputation checking** from worker scanner
2. **Uses DoH for consistency** with other engine scanners
3. **Maintains same RBL lists** (zen.spamhaus.org, b.barracudacentral.org, bl.spamcop.net)
4. **Implements engine contract** (`BaseScanner.execute()` → `ScannerResult`)
5. **Removes duplicate functionality** between worker and engine

### Design Decisions

**Why move IP-RBL to engine?**
- IP reputation is a core deliverability concern
- Should be deterministic and evidence-based like other scanners
- Engine is persistence-agnostic and framework-agnostic
- Prevents scanner divergence (different implementations, different scoring)

**Scope:**
- **Domain blacklist** remains in worker (edge case, lower priority)
- **IP blacklist** moves to engine (core deliverability feature)
- Worker scanner will be simplified to use engine scanner via future integration

### Implementation Plan

1. **Create `IpBlacklistScanner`** in `packages/engine/src/scanners/ip.blacklist.scanner.ts`
2. **Register scanner** in `packages/engine/src/core/orchestrator.ts` (via plugin system)
3. **Write comprehensive tests** in `packages/engine/src/scanners/ip.blacklist.scanner.test.ts`
4. **Document unified scanning strategy** in this report
5. **DO NOT delete** worker scanner (`P0-06: DO NOT delete worker scanners`)

### Test Coverage Requirements

For `IpBlacklistScanner`:
- **Valid case:** IP not listed → `passed: true`, `scoreWeight: 0`
- **Listed case:** IP on RBL → `passed: false`, `scoreWeight: 75`, correct flags
- **Invalid IP format:** → `passed: false`, descriptive error
- **Network errors:** graceful handling, not blocking
- **Concurrent RBL checks:** all checked
- **Score weight correctness:** matches engine scoring expectations

## Validation Commands

```bash
cd packages/engine && npm run test   # All scanner tests pass
npx tsc --noEmit                  # Type checking
```

## Post-P0-06 State

**Engine package:** `packages/engine/src/scanners/` contains:
- `blacklist.scanner.ts` (domain DBL only)
- `dns.scanner.ts`, `dkim.scanner.ts`, `dmarc.scanner.ts`, `dns.scanner.ts`, `mx.scanner.ts`, `spf.scanner.ts`, `tls.scanner.ts`
- `ip.blacklist.scanner.ts` (new)
- All scanners implement `BaseScanner` contract

**Worker package:** `apps/worker/src/scanners/` contains:
- `dns.scanner.ts`, `spf.scanner.ts`, `dkim.scanner.ts`, `dmarc.scanner.ts`, `mx.scanner.ts`, `tls.scanner.ts`, `smtp.scanner.ts`, `dnssec.scanner.ts`, `whois.scanner.ts`
- `blacklist.scanner.ts` (domain DBL only - simplified)
- All scanners use node:dns directly, no DoH
- ScoringEngine and OmniRouteAI remain worker-specific

## Remaining Work (Phase 1, V1-07)

**Scanner Unification (V1-07):**
- Replace worker scanners with engine scanner calls
- Consolidate scoring logic into engine
- Migrate webhook processing to use engine scanners
- Remove duplicate scanner implementations

## References

- Worker blacklist scanner: `apps/worker/src/scanners/blacklist.scanner.ts`
- Engine blacklist scanner: `packages/engine/src/scanners/blacklist.scanner.ts`
- Phase 0 contract: `docs/PHASE_0_IMPLEMENTATION_CONTRACT.md` § P0-06
- P0-06 requirements: "DO NOT delete worker scanners"