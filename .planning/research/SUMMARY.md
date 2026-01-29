# Project Research Summary

**Project:** x402check v2.0 -- Spec-Compliant SDK Extraction
**Domain:** TypeScript validation SDK (npm package for x402 PaymentRequired response validation)
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

x402check v2.0 extracts the validation logic currently embedded in a plain HTML/JS website into a standalone TypeScript npm package at `packages/x402check/`. The SDK will expose three synchronous, pure-function APIs -- `validate()`, `detect()`, and `normalize()` -- following patterns established by Zod, Ajv, and libphonenumber-js. The package will ship ESM, CJS, and browser (IIFE/UMD) bundles with zero runtime dependencies, vendoring only two crypto primitives: a ~45-line Base58 decoder for Solana address validation and a ~150-200 line keccak256 implementation (extracted from the MIT-licensed, Cure53-audited `@noble/hashes`) for EIP-55 EVM address checksum verification. The target browser bundle size is under 15KB minified.

The recommended build toolchain is **tsdown** (not tsup). Stack research revealed that tsup is no longer actively maintained and recommends migration to tsdown, which provides native UMD format support (tsup only supports IIFE), TypeScript 5.9 compatibility (tsup has known DTS failures), and faster Rust-based builds. tsdown's API is tsup-compatible, making the migration path straightforward. Tests use vitest 4.x (native TS, no Babel), and the monorepo uses npm workspaces -- the simplest option for a 2-package repo. The architecture is a synchronous, stateless, layered validation pipeline where each rule is a pure function returning `ValidationIssue[]`. Website integration replaces ~810KB of CDN scripts (ethers.js alone) with a single ~15KB IIFE bundle.

The primary risks are concentrated in crypto vendoring: confusing Keccak-256 with SHA-3 (different padding, completely different outputs) and mishandling Base58 leading-zero bytes. Both produce silent corruption -- addresses validate incorrectly with no obvious error. Secondary risks involve TypeScript package publishing (the `exports` field in package.json is notoriously fragile across resolution modes) and the website integration (the SDK's result shape differs from the current `validator.js` in 8+ field names). All critical risks have well-documented prevention strategies and deterministic test vectors.

## Key Findings

### 1. Use tsdown, Not tsup

STACK.md's most impactful finding: tsup is unmaintained and recommends migration to tsdown. tsdown provides native UMD support (the PRD requirement), TypeScript 5.9 DTS compatibility, and a tsup-compatible API. The ARCHITECTURE.md file still references tsup in its code examples -- this should be treated as superseded by the STACK.md recommendation. **Fallback:** If tsdown causes issues, tsup 8.5.1 works for ESM+CJS but requires IIFE (not UMD) for browser and pinning TypeScript to 5.8.x.

### 2. Keccak-256 is NOT SHA-3

The highest-risk implementation detail. Ethereum uses pre-NIST Keccak-256, not the finalized SHA-3-256 standard. They produce completely different outputs. PITFALLS.md provides a canary test: hash an empty string and assert the result equals `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`. If it equals `a7ffc6f...`, the implementation is fatally wrong. STACK.md recommends extracting from `@noble/hashes` (MIT, audited); ARCHITECTURE.md suggests bundling it as a devDependency and letting the build tool tree-shake it.

### 3. Error Codes Are the Foundation

FEATURES.md identifies error codes (TS-2) as the single foundational dependency -- every other feature references them. The SDK should use `SCREAMING_SNAKE_CASE` string constants via `as const` objects (not TypeScript enums, which don't tree-shake). Machine-readable codes like `MISSING_SCHEME`, `INVALID_NETWORK_FORMAT`, and `BAD_EVM_CHECKSUM` are the stable API contract; human messages are convenience.

### 4. Layered Validation Pipeline, Not Schema Library

ARCHITECTURE.md defines a 6-level pipeline (Parse -> Detect -> Normalize -> Structure -> Fields -> Network) with short-circuit on structural errors. FEATURES.md confirms this pattern as table stakes (TS-8). Both documents strongly recommend against Zod/Ajv -- they add 13-50KB for functionality that is worse than hand-written rules for domain-specific validation with fix suggestions.

### 5. Fix Suggestions Are the Primary Differentiator

FEATURES.md identifies `fix` suggestions (DF-1) as the SDK's core UX advantage over generic validators. When the SDK detects `network: "base"`, it should say `"Use 'eip155:8453' instead of 'base'"`. When it detects a bad EVM checksum, it should provide the correctly checksummed address. This requires the chain registry and address validation to work together.

### 6. Named Exports Only -- No Default Export

PITFALLS.md warns that `export default` in the entry point breaks IIFE global access patterns. The SDK must use only named exports: `export { validate, detect, normalize }`. With IIFE format and `globalName: 'x402Validate'`, these become `window.x402Validate.validate`, `window.x402Validate.detect`, etc.

### 7. Website Integration Has 8+ Breaking Field Changes

The SDK result shape differs from the current `validator.js` in at least 8 fields: `detectedFormat` -> `version`, `normalized.payments` -> `normalized.accepts`, `chain` -> `network` (CAIP-2), `address` -> `payTo`, `minAmount` -> `amount`, format value `'flat'` -> `'flat-legacy'`, and removal of `_normalizedAmount`. ARCHITECTURE.md recommends a thin adapter function in `input.js` to bridge the gap.

### 8. Solana Validation Has a Hard Ceiling

Solana addresses have no checksum. Validation can only confirm valid Base58 alphabet + 32-byte decoded length. Typo detection is impossible. Do not over-invest here; focus effort on making EVM checksum validation excellent.

## Stack Summary

**New additions (SDK package devDependencies only):**

| Technology | Version | Purpose |
|------------|---------|---------|
| tsdown | ^0.20.1 | Build: ESM + CJS + UMD + DTS |
| vitest | ^4.0.17 | Test runner with coverage |
| typescript | ^5.8.0 | Type checking |
| @vitest/coverage-v8 | ^4.0.17 | Coverage reporting |

**Runtime dependencies:** None. Zero. Hard requirement.

**Vendored code:**
- Base58 decoder (~45 lines, written from scratch)
- Keccak-256 (~150-200 lines, extracted from `@noble/hashes` MIT)
- EIP-55 checksum (~15 lines on top of keccak)

**Monorepo:** npm workspaces (`packages/*`), root `package.json` with `private: true`

## Feature Priority

**Table stakes (must ship in v1.0):**
- `validate()` returning structured `{ valid, errors, warnings, normalized }`
- `detect()` for format identification (v2, v1, flat-legacy, unknown)
- `normalize()` for any-format-to-canonical-v2 conversion
- Machine-readable error codes with field paths
- Human-readable messages with fix suggestions
- Errors vs warnings severity distinction
- Layered validation (structure before fields before network)
- TypeScript types, string + object input support

**Should have (ship in v1.0 if possible, otherwise fast follow):**
- Strict mode (warnings become errors)
- Extensible chain validation registry (CAIP-2 namespace dispatch)
- Normalized result included in validate() output
- Known asset registry per network

**Anti-features (never build):**
- Network calls, async validation, mutable state
- Payment construction or signing
- Schema libraries (Zod/Ajv) as internal engine
- Per-rule configurable severity
- Custom error message templates / i18n

## Architecture Approach

The SDK is a **synchronous, stateless, layered validation pipeline**. Input enters as `unknown`, gets parsed (JSON if string), detected (format identification), normalized (to canonical v2 shape), then validated through 5 rule layers. Each rule is a pure function: `(entry, path) => ValidationIssue[]`. The orchestrator (`validate.ts`) calls rules sequentially and aggregates results.

**Major components:**

1. **Public API** (`index.ts`) -- Re-exports `validate`, `detect`, `normalize` as named exports
2. **Orchestrator** (`validate.ts`) -- Runs the 6-level pipeline, aggregates issues, applies strict mode
3. **Detector** (`detect.ts`) -- Identifies v2/v1/flat-legacy/unknown from structural markers
4. **Normalizer** (`normalize.ts`) -- Maps any recognized format to canonical v2 shape
5. **Rule modules** (`rules/*.ts`) -- Structure, requirements, network, address, amount validators
6. **Registries** (`networks.ts`, `assets.ts`) -- CAIP-2 network data, known asset addresses
7. **Crypto primitives** (`vendor/base58.ts`, `vendor/keccak256.ts`) -- Vendored, zero-dep

**Key architectural decisions:**
- No Chain of Responsibility pattern -- fixed pipeline order is simpler and more debuggable
- No rule registry abstraction -- direct function calls in validate.ts
- No async -- all validation is pure computation
- Address validation dispatches by CAIP-2 namespace (`evm`, `solana`), not by specific chain ID

## Critical Pitfalls (Top 5)

1. **Keccak-256 vs SHA-3 confusion** -- Use the function explicitly named `keccak256` or `keccak_256`, never `sha3()`. Add an empty-string canary test in CI. Extract from `@noble/hashes` which provides correct Keccak. *Phase: Crypto vendoring.*

2. **Base58 leading-zero byte loss** -- Each leading `1` in Base58 represents a `0x00` byte that pure BigInt division loses. Count leading `1`s and prepend zero bytes. Test with all-`1` addresses. *Phase: Crypto vendoring.*

3. **Build tool IIFE export behavior** -- Use only named exports (no `export default`). Test that `window.x402Validate.validate` is a function in a browser environment after building. *Phase: Build pipeline.*

4. **package.json `exports` types resolution** -- Put `"types"` FIRST in each conditional export block. Generate both `.d.ts` and `.d.mts`. Run `@arethetypeswrong/cli --pack .` before publishing. *Phase: Package config.*

5. **Website integration shape mismatch** -- Map all 8+ field name changes before starting integration. Use an adapter function or rewrite display code to use new spec-correct names. *Phase: Website integration.*

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 0: Repository Restructuring
**Rationale:** Must happen first -- monorepo structure is a prerequisite for all SDK work.
**Delivers:** Root `package.json` with workspaces config, `packages/x402check/` directory skeleton, initial `package.json` + `tsconfig.json` + build config.
**Addresses:** Monorepo setup (STACK), directory structure (ARCHITECTURE)
**Avoids:** Pitfall 8 (workspace breaks website serving) -- test `index.html` still loads after restructuring. Pitfall 12 (name squatting) -- verify `npm view x402check` before proceeding.
**Effort:** ~0.5 days

### Phase 1: Types, Detection, and Normalization
**Rationale:** Types are the foundation everything else builds on. Detection and normalization have no crypto dependencies and establish the data contracts that all validation rules consume. Error codes must exist before any rule can reference them.
**Delivers:** `types.ts`, `detect.ts`, `normalize.ts`, `networks.ts`, `assets.ts` with full test coverage.
**Addresses:** TS-2 (error codes), TS-5 (detect), TS-6 (types), DF-3 (normalize), DF-5 (spec-aware detection), DF-6 (chain registry), DF-8 (asset registry)
**Avoids:** Pitfall 13 (fixture drift) -- create fixtures from the canonical x402 spec, not existing code
**Effort:** ~3-4 days

### Phase 2: Crypto Vendoring and Address Validation
**Rationale:** Crypto primitives are the highest-risk components and must be proven correct before building validation rules on top. Base58 and keccak256 are independent and can be built/tested in parallel.
**Delivers:** `vendor/base58.ts`, `vendor/keccak256.ts`, `rules/address.ts` with EVM checksum and Solana byte-length validation.
**Addresses:** Deep address validation (PRD requirement), EIP-55 checksums, Solana Base58 decoding
**Avoids:** Pitfall 1 (keccak vs SHA-3), Pitfall 2 (Base58 leading zeros), Pitfall 6 (EIP-55 input encoding), Pitfall 9 (Solana validation ceiling -- accept the limitation and document it)
**Effort:** ~2-3 days

### Phase 3: Validation Rules and Orchestrator
**Rationale:** With types, detection, normalization, and address validation in place, the remaining rules (structure, requirements, amount, network) and the orchestrator can be built. This phase wires everything together into the public API.
**Delivers:** `rules/structure.ts`, `rules/requirements.ts`, `rules/amount.ts`, `rules/network.ts`, `validate.ts`, `index.ts`. Full `validate()` API with errors, warnings, fix suggestions, strict mode.
**Addresses:** TS-1 (validate API), TS-3 (field paths), TS-4 (messages), TS-7 (string/object input), TS-8 (layered validation), DF-1 (fix suggestions), DF-2 (errors/warnings), DF-4 (strict mode), DF-7 (normalized in result)
**Avoids:** Over-abstracting the rule system (ARCHITECTURE anti-pattern 2)
**Effort:** ~4-5 days

### Phase 4: Build Pipeline and Package Publishing
**Rationale:** Build config is easier to debug with working code. All three output formats (ESM, CJS, UMD/IIFE) need verification. Type declarations must resolve across all consumer configurations.
**Delivers:** Working tsdown config producing all formats, verified type declarations, `npm pack` producing correct tarball, browser IIFE bundle tested.
**Addresses:** Build requirements (STACK), package.json exports (ARCHITECTURE)
**Avoids:** Pitfall 3 (IIFE export nesting), Pitfall 4 (types resolution), Pitfall 5 (dist excluded from publish), Pitfall 11 (Node code in browser bundle)
**Effort:** ~1-2 days

### Phase 5: Website Integration
**Rationale:** Requires a proven, built SDK. Keeps the existing website working until the SDK is validated.
**Delivers:** Updated `index.html` (5 script tags become 2), adapted `input.js`, retired `validator.js` + `chains.js`, updated example configs to canonical v2 format.
**Addresses:** Website integration (ARCHITECTURE), CDN distribution (ARCHITECTURE)
**Avoids:** Pitfall 7 (result shape mismatch) -- map all 8+ field changes, use adapter function or rewrite display code
**Effort:** ~2-3 days

### Phase Ordering Rationale

- **Phase 0 before everything:** Monorepo structure is a physical prerequisite for SDK code.
- **Phase 1 before Phase 2:** Types define the interfaces that crypto/address validation returns. Detection and normalization provide the data that rules consume. Error codes are the foundation every rule references.
- **Phase 2 before Phase 3:** Address validation is the deepest risk. If keccak256 vendoring fails or takes longer than expected, it should not block other validation rules -- but the rules need the address module's interface to be defined.
- **Phase 3 before Phase 4:** Build config is easier to iterate on with working code and passing tests.
- **Phase 4 before Phase 5:** Website integration requires a built IIFE bundle. Don't touch the working website until the SDK is proven.
- **Total estimated effort:** 13-18 developer-days across all phases.

### Research Flags

**Phases needing research during planning:**
- **Phase 2 (Crypto Vendoring):** Keccak-256 extraction approach needs validation. Two viable strategies exist: (a) vendor ~150-200 lines from `@noble/hashes` into `src/vendor/keccak256.ts`, or (b) add `@noble/hashes` as devDependency and bundle via tsdown tree-shaking. Strategy (b) is simpler but may produce a larger bundle. A test build should determine the size impact.
- **Phase 4 (Build Pipeline):** tsdown's exact config options for UMD format, globalName, and output extensions should be verified against tsdown documentation. STACK.md rates tsdown UMD config confidence as MEDIUM.

**Phases with standard patterns (skip research):**
- **Phase 0 (Repo Restructuring):** npm workspaces -- fully documented, trivial.
- **Phase 1 (Types/Detection):** Standard TypeScript patterns, clear from FEATURES.md research.
- **Phase 3 (Validation Rules):** Well-established patterns from Zod/Ajv/ESLint research.
- **Phase 5 (Website Integration):** Integration points fully mapped in ARCHITECTURE.md.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | vitest, TypeScript, npm workspaces are proven. tsdown is MEDIUM (0.x but active, production adopters, tsup as fallback). |
| Features | HIGH | Cross-referenced Zod, Ajv, libphonenumber-js, multicoin-address-validator. Feature list is complete and prioritized. |
| Architecture | HIGH | Layered pipeline is a standard pattern. Component boundaries are clear. Build pipeline uses proven tools. |
| Pitfalls | HIGH | Verified against official specs (EIP-55, Base58, tsup issues, TypeScript publishing). Phase-specific warnings are actionable. |

**Overall confidence:** HIGH

### Gaps to Address

1. **tsdown UMD config specifics:** The exact tsdown options for UMD format (`globalName`, `outExtension`, `platform`) need verification against current tsdown docs. STACK.md provides a config template but marks it MEDIUM confidence. **Resolution:** Verify during Phase 4 implementation; tsup IIFE is the fallback.

2. **Keccak-256 vendoring strategy:** STACK.md estimates 150-200 lines and ~3-4KB minified for surgical extraction. ARCHITECTURE.md suggests bundling `@noble/hashes` as a devDependency (estimated ~7-10KB for keccak portion). The exact size difference should be measured with a test build. **Resolution:** Try the devDependency-bundle approach first (simpler); if bundle size exceeds the 15KB target, switch to surgical extraction.

3. **tsdown vs tsup disagreement across research files:** STACK.md recommends tsdown; ARCHITECTURE.md's examples use tsup. **Resolution:** Follow STACK.md (tsdown). ARCHITECTURE.md's tsup examples are illustrative of the pattern, not prescriptive of the tool.

4. **npm name availability:** `x402check` must be verified as available on npm before work begins. **Resolution:** Run `npm view x402check` in Phase 0. Backup names: `@x402check/core`, `x402-validate`.

5. **TypeScript version range interaction with tsdown:** STACK.md recommends `^5.8.0` which allows 5.9.x. tsdown supports 5.9; tsup does not. If the fallback to tsup is ever needed, TypeScript must be pinned to 5.8.x. **Resolution:** Use `^5.8.0` and only pin if falling back to tsup.

## Sources

### Primary (HIGH confidence)
- [EIP-55 Specification](https://eips.ethereum.org/EIPS/eip-55) -- EVM address checksum algorithm
- [CAIP-2 Specification](https://chainagnostic.org/CAIPs/caip-2) -- blockchain ID format
- [coinbase/x402 GitHub](https://github.com/coinbase/x402) -- canonical PaymentRequirements schema
- [x402 V2 Launch Announcement](https://www.x402.org/writing/x402-v2-launch) -- v1 vs v2 differences
- [Zod](https://zod.dev/) -- safeParse() pattern, error structure, as-const over enums
- [Ajv](https://ajv.js.org/) -- strict mode pattern, error reporting
- [vitest](https://vitest.dev/) -- v4.x configuration and coverage
- [@noble/hashes](https://github.com/paulmillr/noble-hashes) -- MIT, Cure53 audited, keccak source
- [npm workspaces](https://docs.npmjs.com/cli/v10/using-npm/workspaces) -- monorepo configuration
- [tsup issues #924, #1290, #1369](https://github.com/egoist/tsup) -- UMD limitations, IIFE behavior, TS 5.9 DTS failures
- [TypeScript ESM/CJS publishing](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing) -- exports field patterns
- [@arethetypeswrong/cli](https://github.com/arethetypeswrong/arethetypeswrong.github.io) -- type resolution validation
- [SHA3 vs Keccak-256](https://ethereumclassic.org/blog/2017-02-10-keccak/) -- padding difference explanation

### Secondary (MEDIUM confidence)
- [tsdown npm](https://www.npmjs.com/package/tsdown) -- v0.20.1, active development, tsup successor
- [tsdown docs](https://tsdown.dev/) -- configuration, UMD format support, migration from tsup
- [TresJS tsdown migration](https://tresjs.org/blog/tresjs-tsdown-migration) -- production adopter case study
- [multicoin-address-validator](https://www.npmjs.com/package/multicoin-address-validator) -- chain-type extensibility pattern
- [libphonenumber-js](https://www.npmjs.com/package/libphonenumber-js) -- detect/validate/normalize trifecta pattern
- [base58-js](https://www.npmjs.com/package/base58-js) -- ~560 byte pure JS Base58 reference
- [Solana Base58Check discussion](https://github.com/solana-labs/solana/issues/6970) -- no checksum confirmation

### Tertiary (needs validation during implementation)
- tsdown exact UMD config options (`globalName`, `outExtension` for UMD format)
- Keccak-256 extraction line count from `@noble/hashes` (estimated 150-200, needs verification)
- Bundle size with bundled `@noble/hashes` via tree-shaking (estimated 7-10KB, needs test build)

---
*Research completed: 2026-01-29*
*Ready for roadmap: yes*
