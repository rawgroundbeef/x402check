# x402check

## What This Is

A developer tool and npm package for validating x402 payment configurations. The `x402check` SDK provides `validate()`, `detect()`, and `normalize()` APIs for any JavaScript/TypeScript project, while the website at x402check.com offers instant browser-based validation with actionable fix suggestions.

## Core Value

Developers can validate their x402 config in under 30 seconds and get specific, fixable feedback.

## Current State

**Shipped:** v2.0 Spec-Compliant SDK (2026-02-04)
**Live:** x402check.com
**Stack:** TypeScript SDK (pnpm monorepo) + Plain HTML/JS website + Cloudflare Worker proxy
**LOC:** 2,502 lines SDK TypeScript, 11,937 total project lines
**Package:** `x402check` — ESM + CJS + IIFE (27KB minified, 9KB gzipped)
**Tests:** 217 test cases

The SDK correctly implements the canonical x402 v1/v2 specs with CAIP-2 network validation, EIP-55 address checksums, and vendored crypto primitives. The website is rebuilt on the SDK's browser bundle.

## Requirements

### Validated

- ✓ User can enter URL or JSON and get validation results — v1.0
- ✓ Tool fetches URLs via CORS proxy — v1.0
- ✓ Clear pass/fail with actionable error messages — v1.0
- ✓ Chain-specific address validation (EVM checksum, Solana Base58) — v1.0
- ✓ Example configs loadable with one click — v1.0
- ✓ Mobile responsive — v1.0
- ✓ Spec-correct validation of x402 v1 and v2 PaymentRequired responses — v2.0
- ✓ Standalone npm package (`x402check`) usable by any JS/TS project — v2.0
- ✓ Browser-compatible IIFE bundle loadable via `<script>` tag — v2.0
- ✓ Comprehensive test suite (217 cases, every field, every error path) — v2.0
- ✓ Format detection (`v2`, `v1`, `flat-legacy`, `unknown`) — v2.0
- ✓ Normalization of any format to canonical v2 shape — v2.0
- ✓ Deep address validation for EVM (EIP-55 checksum) and Solana (Base58) — v2.0
- ✓ Extensible chain validation (registry-based, community PRs) — v2.0
- ✓ Known networks registry (CAIP-2) and known assets registry — v2.0
- ✓ Strict mode option (warnings become errors for CI/CD) — v2.0
- ✓ Zero runtime dependencies (vendored Base58 + keccak256) — v2.0
- ✓ Website rebuilt on SDK browser bundle — v2.0

### Active

(None — fresh requirements needed for next milestone)

### Out of Scope

- Test payments — validation only, no actual transactions
- Facilitator liveness checks — just validate URL format, don't ping
- On-chain balance validation — don't check if address has funds
- Batch validation — one config at a time
- User accounts — contradicts simplicity
- Schema library (Zod/Ajv) internally — adds 13-50KB for ~20 rules
- Async validation — all rules are pure synchronous computation

## Context

**x402 Protocol (canonical v2 spec from coinbase/x402):**
- HTTP 402 Payment Required responses contain payment config
- Config in `PAYMENT-REQUIRED` response header (base64 JSON) — v2 transport
- Config in response body (JSON) — v1 transport
- Root fields: `x402Version` (required, must be 2), `error`, `resource`, `accepts`, `extensions`
- Each `accepts` entry: `scheme`, `network` (CAIP-2), `amount`, `asset`, `payTo`, `maxTimeoutSeconds`, `extra`
- Networks use CAIP-2 format: `eip155:8453` (Base), `solana:5eykt4...` (Solana)

**Architecture:**
- Monorepo: `packages/x402check/` (SDK), `apps/website/` (site), `packages/config/` (shared TS config)
- SDK: Pure functions, no side effects, tree-shakeable
- Build: tsdown → ESM + CJS + IIFE
- Crypto: @noble/hashes (keccak-256), @scure/base (Base58) as devDependencies, tree-shaken into bundle

## Constraints

- **Client-side first**: All validation logic runs in browser, proxy only for URL fetching
- **CORS**: Direct URL fetches will fail, proxy required for URL input method
- **Zero runtime deps**: SDK must have no runtime dependencies for browser bundle size
- **Monorepo**: SDK lives in `packages/x402check/`, website at `apps/website/`, pnpm workspaces

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Plain HTML/JS over React | Simplicity, zero build step, fast to ship | ✓ Good — shipped fast |
| Cloudflare Worker for proxy | Lightweight, free tier sufficient | ✓ Good — works well |
| Skip facilitator reachability | Overkill for v1 | ✓ Good |
| Layered validation (L1-L5) | Prevents error cascades | ✓ Good — keep pattern |
| Monorepo structure | SDK in packages/x402check/, website at apps/website/ | ✓ Good — clean separation |
| Zero runtime deps | Vendor Base58 + keccak256 via tree-shaking | ✓ Good — 27KB IIFE bundle |
| TypeScript + tsdown | Type safety, ESM/CJS/IIFE output | ✓ Good — publint validated |
| Strict mode | Warnings→errors for CI/CD enforcement | ✓ Good — simple and effective |
| IIFE over UMD | tsdown supports natively, functionally equivalent for `<script>` tags | ✓ Good |
| Named exports only | IIFE compatibility, no default export confusion | ✓ Good |
| @noble/hashes as devDeps | Audited crypto, tree-shaken by bundler, zero runtime deps | ✓ Good |
| Checksum = warning not error | All-lowercase addresses are valid but risky | ✓ Good — better UX |
| CAIP-2 for networks | Canonical spec compliance, future-proof | ✓ Good — replaced simple names |
| Remove flat-legacy support | x402Version required per spec | ✓ Good — cleaner validation |
| Local IIFE bundle symlink | Package not yet published to npm | ⚠️ Revisit — publish to npm |

---
*Last updated: 2026-02-04 after v2.0 milestone*
