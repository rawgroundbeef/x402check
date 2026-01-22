# x402check

## What This Is

A developer tool that validates x402 payment configurations. Enter a URL or paste JSON, get instant feedback on whether the config is valid with actionable guidance on how to fix issues. Built for developers implementing x402 payments who need a quick way to test their setup before deploying.

## Core Value

Developers can validate their x402 config in under 30 seconds and get specific, fixable feedback — no docs required.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can enter a URL and validate the 402 response config
- [ ] User can paste raw JSON and validate directly
- [ ] Tool fetches URL via proxy to handle CORS
- [ ] Tool validates all required fields (x402Version, payments array, chain, address, asset, minAmount)
- [ ] Tool validates optional fields when present (resource, description, facilitator, maxAmount, payTo)
- [ ] Tool performs chain-specific address validation (EVM 0x format, Solana base58)
- [ ] Tool validates chain/asset combinations (USDC/ETH/USDT for EVM, USDC/SOL for Solana)
- [ ] Results show clear pass/fail with specific error messages
- [ ] Error messages include the fix (not just what's wrong)
- [ ] Warnings distinguish "will break" from "not recommended"
- [ ] User can load an example valid config
- [ ] User can see the parsed raw JSON

### Out of Scope

- Test payments — validation only, no actual transactions
- Facilitator liveness checks — just validate URL format, don't ping
- On-chain balance validation — don't check if address has funds
- Batch validation — one config at a time
- Custom/unknown chains — strict validation of known chains only (base, base-sepolia, solana, solana-devnet)
- Dark mode — defer to v1.1
- Share links — defer to v1.1

## Context

**x402 Protocol:**
- HTTP 402 Payment Required responses contain payment config
- Config lives in `X-Payment` header (JSON string) or response body
- Defines where to send payment, what chain/asset, how much

**Validation Rules (from spec):**
- Required: `x402Version` (must be 1), `payments` array (at least one)
- Each payment: `chain`, `address`, `asset`, `minAmount` (positive decimal)
- Supported chains: `base`, `base-sepolia`, `solana`, `solana-devnet`
- EVM addresses: 42-char hex starting with `0x`
- Solana addresses: Base58, 32-44 characters
- EVM assets: USDC, ETH, USDT
- Solana assets: USDC, SOL

**URL Fetch Behavior:**
- GET request to URL
- 402 response: check `X-Payment` header, fall back to body
- 200 response: try to parse body as config (testing mode)
- Other status codes: error

## Constraints

- **Tech stack**: Plain HTML/JS (no framework) + Cloudflare Worker proxy — maximum simplicity
- **Client-side first**: All validation logic runs in browser, proxy only for URL fetching
- **CORS**: Direct URL fetches will fail, proxy required for URL input method

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Plain HTML/JS over React | Simplicity, zero build step, fast to ship | — Pending |
| Cloudflare Worker for proxy | Lightweight, free tier sufficient, easy deploy | — Pending |
| Strict chain validation | Permissive mode adds complexity, known chains cover real use cases | — Pending |
| Skip facilitator reachability | Overkill for v1, just validate structure | — Pending |

---
*Last updated: 2025-01-22 after initialization*
