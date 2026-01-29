# x402check

## What This Is

A developer tool that validates x402 payment configurations. Enter a URL or paste JSON, get instant feedback on whether the config is valid with actionable guidance on how to fix issues. Live at x402check.com.

## Core Value

Developers can validate their x402 config in under 30 seconds and get specific, fixable feedback.

## Current State

**Shipped:** v1.0 MVP (2026-01-29)
**Live:** x402check.com
**Stack:** Plain HTML/JS + Cloudflare Worker proxy
**LOC:** ~3,000 lines HTML/JS

The site is live and functional. However, the validator was built on assumptions about the x402 spec that turned out to be wrong. The canonical x402 v2 spec (from coinbase/x402) uses different field names and structure than what the validator implements.

## Requirements

### Validated

- ✓ User can enter URL or JSON and get validation results — v1.0
- ✓ Tool fetches URLs via CORS proxy — v1.0
- ✓ Clear pass/fail with actionable error messages — v1.0
- ✓ Chain-specific address validation (EVM checksum, Solana Base58) — v1.0
- ✓ Example configs loadable with one click — v1.0
- ✓ Mobile responsive — v1.0

### Active

- [ ] Spec-correct validation of x402 v1 and v2 PaymentRequired responses
- [ ] Standalone npm package (`x402check`) usable by any JS/TS project
- [ ] Browser-compatible UMD bundle loadable via CDN `<script>` tag
- [ ] Comprehensive test suite (100+ cases, every field, every error path)
- [ ] Backward-compatible detection of flat-legacy configs
- [ ] Format detection (`v2`, `v1`, `flat-legacy`, `unknown`)
- [ ] Normalization of any format to canonical v2 shape
- [ ] Deep address validation for EVM (EIP-55 checksum) and Solana (Base58)
- [ ] Extensible chain validation (easy for community PRs to add new chains)
- [ ] Known networks registry (CAIP-2) and known assets registry
- [ ] Strict mode option (warnings become errors for CI/CD)
- [ ] Zero runtime dependencies (vendored Base58 + keccak256)
- [ ] Website rebuilt on SDK via CDN import

### Out of Scope

- Test payments — validation only, no actual transactions
- Facilitator liveness checks — just validate URL format, don't ping
- On-chain balance validation — don't check if address has funds
- Batch validation — one config at a time
- User accounts — contradicts simplicity

## Context

**x402 Protocol (canonical v2 spec from coinbase/x402):**
- HTTP 402 Payment Required responses contain payment config
- Config in `PAYMENT-REQUIRED` response header (base64 JSON) — v2 transport
- Config in response body (JSON) — v1 transport
- Root fields: `x402Version` (required, must be 2), `error`, `resource`, `accepts`, `extensions`
- Each `accepts` entry: `scheme`, `network` (CAIP-2), `amount`, `asset`, `payTo`, `maxTimeoutSeconds`, `extra`
- Networks use CAIP-2 format: `eip155:8453` (Base), `solana:5eykt4...` (Solana)
- `extra` block carries scheme-specific data (EIP-712 domain params for EVM)

**Known spec mismatches in v1.0 validator:**
| v1.0 validator | Canonical spec |
|---|---|
| `payments` | `accepts` |
| `address` | `payTo` |
| `chain` | `network` (CAIP-2) |
| `minAmount` | `amount` (v2) / `maxAmountRequired` (v1) |
| No `scheme` field | `scheme` required |
| No `resource` object | `resource` required in v2 |
| No `maxTimeoutSeconds` | Required |
| Simple chain names | CAIP-2 format |

## Current Milestone: v2.0 Spec-Compliant SDK

**Goal:** Extract validation into a standalone npm package that correctly implements the canonical x402 v1/v2 specs, then rebuild the website on top of it.

**Target features:**
- Standalone `x402check` npm package in `packages/x402check/`
- TypeScript source with ESM + CJS + UMD build outputs
- Spec-correct validation (v1, v2, flat-legacy detection and normalization)
- Deep address validation for EVM + Solana, extensible for other chains
- Strict mode for CI/CD pipelines
- Zero runtime dependencies
- Website integration via CDN `<script>` tag

## Constraints

- **Client-side first**: All validation logic runs in browser, proxy only for URL fetching
- **CORS**: Direct URL fetches will fail, proxy required for URL input method
- **Zero runtime deps**: SDK must have no runtime dependencies for browser bundle size
- **Monorepo**: SDK lives in `packages/x402check/`, website stays at root

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Plain HTML/JS over React | Simplicity, zero build step, fast to ship | ✓ Good — shipped fast |
| Cloudflare Worker for proxy | Lightweight, free tier sufficient | ✓ Good — works well |
| Strict chain validation | Known chains cover real use cases | ⚠️ Revisit — need CAIP-2 |
| Skip facilitator reachability | Overkill for v1 | ✓ Good |
| CDN with SRI hashes | Library integrity verification | ✓ Good |
| ethers.js v5.7.2 | Better CDN availability than v6 | ✓ Good |
| Layered validation | Prevents error cascades | ✓ Good — keep pattern |
| Monorepo structure | SDK in packages/x402check/, website at root | — Pending |
| Zero runtime deps | Vendor Base58 + keccak256 for tiny browser bundle | — Pending |
| TypeScript + tsup | Type safety for SDK, ESM/CJS/UMD output | — Pending |
| Strict mode | Warnings→errors for CI/CD enforcement | — Pending |

---
*Last updated: 2026-01-29 after v2.0 milestone started*
