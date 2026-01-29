# Roadmap: x402check

## Milestones

- v1.0 MVP - Phases 1-4 (shipped 2026-01-29)
- v2.0 Spec-Compliant SDK - Phases 5-10 (in progress)

## Overview

v2.0 extracts the validation logic from the plain HTML/JS website into a standalone TypeScript npm package (`packages/x402check/`) that correctly implements the canonical x402 v1/v2 specs. The SDK exposes three synchronous pure-function APIs -- `validate()`, `detect()`, `normalize()` -- with zero runtime dependencies, vendored crypto primitives, and ESM/CJS/UMD build outputs. The website is then rebuilt on top of the SDK's browser bundle, replacing ~810KB of CDN scripts with a single ~15KB IIFE bundle.

## Phases

**Phase Numbering:**
- Phases 1-4: v1.0 MVP (shipped)
- Phases 5-10: v2.0 Spec-Compliant SDK (current milestone)
- Decimal phases (e.g., 7.1): Urgent insertions if needed

<details>
<summary>v1.0 MVP (Phases 1-4) - SHIPPED 2026-01-29</summary>

### Phase 1: Foundation & Validation
### Phase 2: Input & Proxy
### Phase 3: Results Display & UX
### Phase 4: Examples & Help

</details>

## v2.0 Spec-Compliant SDK

- [x] **Phase 5: Repository Restructuring** - Monorepo scaffold with SDK package skeleton
- [ ] **Phase 6: Types, Detection, and Normalization** - Type system, error codes, format detection, normalization, and registries
- [ ] **Phase 7: Crypto Vendoring and Address Validation** - Vendored keccak256 + Base58, EVM and Solana address validation
- [ ] **Phase 8: Validation Rules and Orchestrator** - All validation rules, orchestrator pipeline, public validate() API
- [ ] **Phase 9: Build Pipeline and Package Publishing** - ESM + CJS + UMD builds, type declarations, package.json exports
- [ ] **Phase 10: Website Integration** - Replace website validator with SDK browser bundle

## Phase Details

### Phase 5: Repository Restructuring
**Goal**: SDK code has a home -- monorepo structure enables all subsequent SDK development without breaking the live website
**Depends on**: Nothing (first v2.0 phase)
**Requirements**: BUILD-06
**Success Criteria** (what must be TRUE):
  1. Running `pnpm install` at the repo root installs workspace dependencies for both root and `packages/x402check/`
  2. The existing website (`index.html`) still loads and functions correctly after restructuring
  3. `packages/x402check/src/index.ts` exists and compiles with `tsc --noEmit`
**Plans:** 1 plan

Plans:
- [x] 05-01-PLAN.md -- Monorepo scaffold, website move, and SDK package skeleton

### Phase 6: Types, Detection, and Normalization
**Goal**: The SDK's type system, error vocabulary, format detection, normalization pipeline, and chain/asset registries are complete -- every downstream module has the interfaces and data it needs
**Depends on**: Phase 5
**Requirements**: API-02, API-03, API-04, API-07, ERR-01, ERR-02, ERR-03, ERR-04, ERR-05, FMT-01, FMT-02, FMT-03, FMT-04, FMT-05, FMT-06, FMT-07, FMT-08, REG-01, REG-02, REG-03, REG-04, REG-05, REG-06
**Success Criteria** (what must be TRUE):
  1. Calling `detect()` on a v2 config object returns `'v2'`, on a v1 config returns `'v1'`, on a flat-legacy config returns `'flat-legacy'`, and on garbage returns `'unknown'`
  2. Calling `normalize()` on a flat-legacy config returns a canonical v2 shape with `accepts[]` array, `scheme: "exact"`, CAIP-2 network, and `amount` field -- and returns `null` on garbage
  3. Calling `detect()` or `normalize()` with a JSON string input works identically to passing a parsed object
  4. Every error code constant (e.g., `MISSING_SCHEME`, `INVALID_NETWORK_FORMAT`) is exported and each has a field path format and human-readable message template
  5. The network registry maps CAIP-2 identifiers to known chains and the asset registry maps known asset addresses per network, with unknown-but-valid CAIP-2 networks producing warnings (not errors)
**Plans:** 3 plans

Plans:
- [ ] 06-01-PLAN.md -- Type system, error codes, and public API signatures
- [ ] 06-02-PLAN.md -- Format detection and normalization
- [ ] 06-03-PLAN.md -- Network and asset registries

### Phase 7: Crypto Vendoring and Address Validation
**Goal**: Vendored crypto primitives are proven correct against reference test vectors, and address validation dispatches by chain type with checksum verification for EVM and byte-length validation for Solana
**Depends on**: Phase 6
**Requirements**: CRYPTO-01, CRYPTO-02, CRYPTO-03, CRYPTO-04, ADDR-01, ADDR-02, ADDR-03, ADDR-04, ADDR-05, TEST-04, TEST-05
**Success Criteria** (what must be TRUE):
  1. Vendored keccak256 hashing an empty string returns `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470` (NOT the SHA-3 output)
  2. Vendored Base58 decoder correctly decodes an all-`1` Solana address preserving leading zero bytes
  3. EIP-55 checksum validation correctly accepts `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed` and rejects a lowercase version as a checksum warning
  4. Address validation returns an error when an EVM-format address is used on a Solana network (cross-chain mismatch)
  5. All crypto primitives have zero runtime dependencies -- only vendored source code
**Plans**: TBD

Plans:
- [ ] 07-01: Keccak-256 and Base58 vendoring with test vectors
- [ ] 07-02: Address validation rules (EVM, Solana, dispatch by CAIP-2 namespace)

### Phase 8: Validation Rules and Orchestrator
**Goal**: The complete `validate()` API works end-to-end -- developers can pass any x402 config (string or object, any format) and get back a structured result with errors, warnings, fix suggestions, and normalized output
**Depends on**: Phase 7
**Requirements**: API-01, API-05, API-06, RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08, RULE-09, RULE-10, RULE-11, TEST-01, TEST-02, TEST-03, TEST-06, TEST-07, TEST-08
**Success Criteria** (what must be TRUE):
  1. `validate('not json')` returns `{ valid: false, errors: [...], warnings: [], version: 'unknown', normalized: null }` without throwing
  2. `validate(validV2Config)` returns `{ valid: true, errors: [], warnings: [], version: 'v2', normalized: {...} }` with the normalized canonical shape
  3. `validate(configWithSimpleChainName)` returns a warning with fix suggestion like `"Use 'eip155:8453' instead of 'base'"`
  4. `validate(config, { strict: true })` promotes all warnings to errors, making a config with only warnings return `valid: false`
  5. The test suite passes 100+ test cases covering every validation rule, every error code, format detection, normalization round-trips, address validation, and real-world config fixtures
**Plans**: TBD

Plans:
- [ ] 08-01: Validation rule modules (structure, fields, network, amount, legacy)
- [ ] 08-02: Orchestrator pipeline and public validate() API
- [ ] 08-03: Integration tests and JSON fixture suite

### Phase 9: Build Pipeline and Package Publishing
**Goal**: The SDK produces correct ESM, CJS, and browser IIFE bundles with working type declarations, and the package is ready for package publishing
**Depends on**: Phase 8
**Requirements**: BUILD-01, BUILD-02, BUILD-03, BUILD-04, BUILD-05
**Success Criteria** (what must be TRUE):
  1. `import { validate } from 'x402check'` works in an ESM module and `const { validate } = require('x402check')` works in a CJS module
  2. Loading the UMD/IIFE bundle via `<script>` tag makes `window.x402Validate.validate` a callable function
  3. The browser bundle is under 15KB minified
  4. TypeScript consumers get full type inference -- `validate()` return type shows `valid`, `errors`, `warnings`, `version`, `normalized` fields with correct types
**Plans**: TBD

Plans:
- [ ] 09-01: Build config (tsdown), output verification, and package.json exports

### Phase 10: Website Integration
**Goal**: The live website uses the SDK browser bundle instead of the old validator.js, removing ~810KB of CDN dependencies while maintaining all existing functionality
**Depends on**: Phase 9
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05
**Success Criteria** (what must be TRUE):
  1. The website loads two script tags (SDK IIFE bundle + app JS) instead of the previous five (ethers.js, bs58, validator.js, chains.js, input.js)
  2. Pasting a valid v2 config into the website shows a green "Valid" result with the same detail level as v1.0
  3. Pasting a legacy flat config into the website shows warnings about deprecated format with fix suggestions
  4. Example configs in the dropdown use canonical v2 format and load/validate correctly
**Plans**: TBD

Plans:
- [ ] 10-01: SDK bundle integration and adapter layer
- [ ] 10-02: Example config updates and CDN cleanup

## Progress

**Execution Order:**
Phases execute in numeric order: 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 5. Repository Restructuring | v2.0 | 1/1 | Complete | 2026-01-29 |
| 6. Types, Detection, Normalization | v2.0 | 0/3 | Planned | - |
| 7. Crypto & Address Validation | v2.0 | 0/2 | Not started | - |
| 8. Validation Rules & Orchestrator | v2.0 | 0/3 | Not started | - |
| 9. Build Pipeline | v2.0 | 0/1 | Not started | - |
| 10. Website Integration | v2.0 | 0/2 | Not started | - |

---
*Roadmap created: 2026-01-29*
*Last updated: 2026-01-29 -- Phase 6 planned*
