# Requirements: x402check v2.0

**Defined:** 2026-01-29
**Core Value:** Developers can validate their x402 config in under 30 seconds with actionable feedback

## v2.0 Requirements

Requirements for spec-compliant SDK extraction and website rebuild. Each maps to roadmap phases.

### SDK Core API

- [ ] **API-01**: `validate(config)` returns structured `{ valid, errors, warnings, version, normalized }` — never throws on invalid input
- [ ] **API-02**: `detect(config)` returns `'v2' | 'v1' | 'flat-legacy' | 'unknown'` based on structural markers
- [ ] **API-03**: `normalize(config)` converts any recognized format to canonical v2 shape, returns `null` if unparseable
- [ ] **API-04**: All public APIs accept `string | object` input (JSON string or parsed object)
- [ ] **API-05**: `validate()` includes `normalized` field in result (null only if completely unparseable)
- [ ] **API-06**: `validate(config, { strict: true })` promotes all warnings to errors
- [ ] **API-07**: Public API exported as named exports only (no default export) — `{ validate, detect, normalize }`

### Validation Rules

- [ ] **RULE-01**: Level 1 — input must be valid JSON, must be an object, must have recognized format
- [ ] **RULE-02**: Level 2 — `x402Version` must be present (error for v2, warning for v1/flat), must be 1 or 2
- [ ] **RULE-03**: Level 2 — `accepts` array must exist and be non-empty
- [ ] **RULE-04**: Level 2 — `resource` object should exist in v2 (warning), `resource.url` should be valid URL
- [ ] **RULE-05**: Level 3 — `scheme` must be present (error for v2, warning for v1/flat)
- [ ] **RULE-06**: Level 3 — `network` must be present and use CAIP-2 format (`namespace:reference`)
- [ ] **RULE-07**: Level 3 — `amount` (v2) / `maxAmountRequired` (v1) must be present, numeric string, positive
- [ ] **RULE-08**: Level 3 — `asset` must be present
- [ ] **RULE-09**: Level 3 — `payTo` must be present
- [ ] **RULE-10**: Level 3 — `maxTimeoutSeconds` should be present in v2 (warning), must be positive integer if present
- [ ] **RULE-11**: Level 5 — Legacy format warnings: flat format, v1 field names, simple chain names, alias fields, missing scheme defaults

### Error Reporting

- [ ] **ERR-01**: Machine-readable error codes (`MISSING_SCHEME`, `INVALID_NETWORK_FORMAT`, etc.) as `as const` string constants
- [ ] **ERR-02**: Field path in dot-notation format (`accepts[0].network`) on every issue
- [ ] **ERR-03**: Human-readable error messages that a developer unfamiliar with x402 can understand
- [ ] **ERR-04**: Actionable fix suggestions where correct value can be inferred (e.g., `"Use 'eip155:8453' instead of 'base'"`)
- [ ] **ERR-05**: Errors vs warnings distinction — errors mean config will fail at runtime, warnings mean suboptimal but functional

### Address Validation

- [ ] **ADDR-01**: EVM address must be 42-char hex with `0x` prefix
- [ ] **ADDR-02**: EVM address checksum validation (EIP-55) using vendored keccak256
- [ ] **ADDR-03**: Solana address must be valid Base58, 32-byte decoded length
- [ ] **ADDR-04**: Address format must match network type (EVM address on Solana network = error)
- [ ] **ADDR-05**: Address validation dispatches by CAIP-2 namespace (`eip155:*` → EVM, `solana:*` → Solana)

### Network & Asset Registry

- [ ] **REG-01**: Known CAIP-2 network registry (Base, Base Sepolia, Avalanche, Avalanche Fuji, Solana mainnet/devnet/testnet, Stellar, Aptos)
- [ ] **REG-02**: Unknown but valid CAIP-2 format produces warning, not error
- [ ] **REG-03**: Simple chain name → CAIP-2 mapping for legacy detection and fix suggestions
- [ ] **REG-04**: Known asset addresses per network (USDC on Base, Solana, etc.)
- [ ] **REG-05**: Unknown assets produce warning, not error
- [ ] **REG-06**: Extensible chain validation — new chains can be added via community PRs to registry files

### Format Detection & Normalization

- [ ] **FMT-01**: Detect v2 (has `accepts` + `x402Version: 2` + `resource`)
- [ ] **FMT-02**: Detect v1 (has `accepts` + `x402Version: 1`, no `resource`)
- [ ] **FMT-03**: Detect flat-legacy (root-level `payTo`/`amount`/`network` or `payments` array)
- [ ] **FMT-04**: Return `unknown` for unrecognized shapes
- [ ] **FMT-05**: Normalize flat-legacy → canonical v2 (wrap in `accepts[]`, map field names, set `scheme: "exact"`)
- [ ] **FMT-06**: Normalize v1 → canonical v2 (`maxAmountRequired` → `amount`, per-entry `resource` → top-level)
- [ ] **FMT-07**: Normalize v2 → pass through unchanged
- [ ] **FMT-08**: Preserve `extra` and `extensions` through normalization

### Crypto Vendoring

- [ ] **CRYPTO-01**: Vendored keccak256 implementation (NOT SHA-3) with empty-string canary test
- [ ] **CRYPTO-02**: Vendored Base58 decoder handling leading-zero bytes correctly
- [ ] **CRYPTO-03**: EIP-55 checksum function built on vendored keccak256
- [ ] **CRYPTO-04**: Zero runtime dependencies — all crypto is vendored source code

### Build & Package

- [ ] **BUILD-01**: TypeScript source compiled to ESM (`index.mjs`), CJS (`index.cjs`), and browser IIFE/UMD (`x402check.umd.js`)
- [ ] **BUILD-02**: TypeScript declarations generated (`.d.ts` and `.d.mts`)
- [ ] **BUILD-03**: Browser bundle exposes `window.x402Validate` with `{ validate, detect, normalize }`
- [ ] **BUILD-04**: Browser bundle under 15KB minified
- [ ] **BUILD-05**: `package.json` with correct `exports`, `main`, `module`, `types`, `files` fields
- [ ] **BUILD-06**: Monorepo structure — SDK in `packages/x402check/`, website at root, npm workspaces

### Testing

- [ ] **TEST-01**: Unit tests for every validation rule (each error code exercised)
- [ ] **TEST-02**: Format detection tests (v2, v1, flat-legacy, unknown)
- [ ] **TEST-03**: Normalization tests (flat → v2, v1 → v2, v2 passthrough, extra/extensions preserved)
- [ ] **TEST-04**: Address validation tests (valid/invalid EVM, valid/invalid Solana, network mismatch)
- [ ] **TEST-05**: Crypto primitive tests (keccak256 canary, Base58 leading zeros, EIP-55 reference vectors)
- [ ] **TEST-06**: Integration tests (real-world configs, round-trip normalize→validate)
- [ ] **TEST-07**: JSON fixture files for reproducible testing
- [ ] **TEST-08**: 100+ test cases total

### Website Integration

- [ ] **WEB-01**: Replace `validator.js` + `chains.js` with SDK UMD bundle via CDN `<script>` tag
- [ ] **WEB-02**: `input.js` calls SDK `validate()` instead of `validateX402Config()`
- [ ] **WEB-03**: Map SDK result shape to display code (handle 8+ field name changes)
- [ ] **WEB-04**: Update example configs to canonical v2 format
- [ ] **WEB-05**: Remove ethers.js and bs58 CDN dependencies (~810KB savings)

## Future Requirements

Deferred beyond v2.0.

### Publishing & Distribution

- **PUB-01**: Publish to npm as `x402check`
- **PUB-02**: CI/CD pipeline for automated testing and publishing
- **PUB-03**: Changelog and versioning automation

### Extended Chain Support

- **CHAIN-01**: Stellar address validation (StrKey encoding)
- **CHAIN-02**: Aptos address validation (hex format)
- **CHAIN-03**: Bitcoin address validation (Base58Check, Bech32)

### Advanced Features

- **ADV-01**: Shareable validation URLs
- **ADV-02**: Custom network validator option (`validate(config, { networkValidators: {...} })`)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Payment payload construction or signing | @x402/core's job, not a validator |
| On-chain verification | Requires RPC connections, async, chain SDKs |
| Facilitator liveness checks | Network calls violate offline validation principle |
| Async validation | All rules are pure synchronous computation |
| Schema library (Zod/Ajv) internally | Adds 13-50KB for ~20 rules, domain logic can't be expressed as schemas |
| Per-rule configurable severity | Only ~20 rules — strict mode is sufficient |
| Custom error message templates / i18n | Machine-readable codes are the stable API |
| Batch validation | One config at a time |
| User accounts | Contradicts simplicity |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| API-01 | — | Pending |
| API-02 | — | Pending |
| API-03 | — | Pending |
| API-04 | — | Pending |
| API-05 | — | Pending |
| API-06 | — | Pending |
| API-07 | — | Pending |
| RULE-01 | — | Pending |
| RULE-02 | — | Pending |
| RULE-03 | — | Pending |
| RULE-04 | — | Pending |
| RULE-05 | — | Pending |
| RULE-06 | — | Pending |
| RULE-07 | — | Pending |
| RULE-08 | — | Pending |
| RULE-09 | — | Pending |
| RULE-10 | — | Pending |
| RULE-11 | — | Pending |
| ERR-01 | — | Pending |
| ERR-02 | — | Pending |
| ERR-03 | — | Pending |
| ERR-04 | — | Pending |
| ERR-05 | — | Pending |
| ADDR-01 | — | Pending |
| ADDR-02 | — | Pending |
| ADDR-03 | — | Pending |
| ADDR-04 | — | Pending |
| ADDR-05 | — | Pending |
| REG-01 | — | Pending |
| REG-02 | — | Pending |
| REG-03 | — | Pending |
| REG-04 | — | Pending |
| REG-05 | — | Pending |
| REG-06 | — | Pending |
| FMT-01 | — | Pending |
| FMT-02 | — | Pending |
| FMT-03 | — | Pending |
| FMT-04 | — | Pending |
| FMT-05 | — | Pending |
| FMT-06 | — | Pending |
| FMT-07 | — | Pending |
| FMT-08 | — | Pending |
| CRYPTO-01 | — | Pending |
| CRYPTO-02 | — | Pending |
| CRYPTO-03 | — | Pending |
| CRYPTO-04 | — | Pending |
| BUILD-01 | — | Pending |
| BUILD-02 | — | Pending |
| BUILD-03 | — | Pending |
| BUILD-04 | — | Pending |
| BUILD-05 | — | Pending |
| BUILD-06 | — | Pending |
| TEST-01 | — | Pending |
| TEST-02 | — | Pending |
| TEST-03 | — | Pending |
| TEST-04 | — | Pending |
| TEST-05 | — | Pending |
| TEST-06 | — | Pending |
| TEST-07 | — | Pending |
| TEST-08 | — | Pending |
| WEB-01 | — | Pending |
| WEB-02 | — | Pending |
| WEB-03 | — | Pending |
| WEB-04 | — | Pending |
| WEB-05 | — | Pending |

**Coverage:**
- v2.0 requirements: 55 total
- Mapped to phases: 0
- Unmapped: 55 (pending roadmap creation)

---
*Requirements defined: 2026-01-29*
*Last updated: 2026-01-29 after initial definition*
