# Technology Stack

**Project:** x402check SDK (v2.0 milestone)
**Researched:** 2026-01-29
**Scope:** Stack additions for standalone TypeScript SDK with zero runtime deps
**Previous:** v1.0 stack (Vanilla JS website, Cloudflare Worker) remains unchanged; this covers NEW SDK package only

## Critical Finding: tsup vs tsdown

The PRD specifies tsup for builds. However, **tsup is no longer actively maintained** and the project itself recommends migrating to tsdown. This is the single most important stack decision for the SDK.

| Factor | tsup 8.5.1 | tsdown 0.20.1 |
|--------|-----------|---------------|
| Maintenance | Unmaintained, recommends tsdown | Actively developed (latest release: Jan 22, 2026) |
| UMD support | No native UMD; IIFE with `globalName` as workaround | Native UMD format support |
| TypeScript 5.9 compat | Known DTS build failures with TS 5.9.x | Built for current TS versions |
| Type generation | Uses tsc (slow, compatibility issues) | Uses Oxc (fast, isolated declarations) |
| ESM output | CJS-first, ESM sometimes missing extensions | ESM-first, correct by default |
| Build speed | esbuild-based (fast) | Rolldown-based (faster, Rust) |
| API compat | N/A | Compatible with tsup's main options |
| npm adoption | 1M+ weekly downloads, established | 74 dependents, growing rapidly |

**Recommendation: Use tsdown.** The PRD's requirement for UMD output is a native feature in tsdown but requires an IIFE workaround in tsup. tsup has known DTS build failures with TypeScript 5.9 (the current stable TS version). tsdown has a migration path from tsup configs and is the officially recommended successor. The 0.20 version number reflects the Rolldown ecosystem's versioning convention, not instability -- it has stable releases and production adopters (TresJS, etc.).

**Fallback plan:** If tsdown causes unexpected issues during implementation, tsup 8.5.1 still functions for ESM+CJS output. The IIFE build with `globalName: 'x402Validate'` would substitute for UMD. TypeScript would need to be pinned at 5.8.x to avoid DTS generation issues.

## Recommended Stack

### Build Tool

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| tsdown | ^0.20.1 | Bundle TS to ESM + CJS + UMD | Native UMD, active maintenance, TS 5.9 compat, faster than tsup |

**Configuration (`tsdown.config.ts`):**

```typescript
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs', 'umd'],
  dts: true,
  clean: true,
  treeshake: true,
  minify: true,
  // UMD global name for <script> tag usage
  globalName: 'x402Validate',
  // No external deps -- bundle everything
  noExternal: [/.*/],
})
```

**Expected outputs:**

```
dist/
  index.mjs          # ESM (Node, bundlers)
  index.cjs          # CJS (legacy Node)
  index.d.ts         # TypeScript declarations
  index.umd.js       # UMD (browser <script> tag)
```

**Confidence:** MEDIUM -- tsdown's config API is tsup-compatible, but the exact option names for UMD-specific settings (like `globalName` for UMD format specifically) should be verified against tsdown docs during implementation. If `globalName` does not apply to UMD format, the IIFE format with `globalName` is the proven fallback.

### Test Runner

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| vitest | ^4.0.17 | Unit + integration tests | 20M weekly downloads, native TS, no Babel needed, fast watch mode |

**Configuration (`vitest.config.ts`):**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/types.ts', 'src/index.ts'],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
      },
    },
  },
})
```

**Why vitest over alternatives:**
- Jest requires Babel/SWC transform for TypeScript -- unnecessary overhead for a TS-only project
- Node test runner (`node:test`) lacks coverage thresholds, watch mode, and rich assertion API
- vitest uses Vite's transform pipeline internally -- no separate TS compilation step needed
- Native ESM support without configuration gymnastics
- vitest 4.0.17 is the current stable release (published 6 days ago as of research date)

**Confidence:** HIGH -- vitest 4.x is current stable with 20M weekly downloads. Configuration above uses only standard, well-documented options.

### TypeScript

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| typescript | ^5.8.0 | Source language, type checking | 5.8 is stable with broad tooling compat; allows 5.9 but doesn't require it |

**Why ^5.8.0 (not pinned to 5.9):**
- TypeScript 5.9.3 is the latest npm release, but 5.8 has the broadest build tool compatibility
- The caret range allows npm to resolve 5.8.x or 5.9.x depending on what's installed
- TypeScript 7 (Go rewrite) is in preview; no benefit to chasing bleeding edge for a validation library
- 5.8 introduced `--erasableSyntaxOnly` and build time optimizations relevant to library authoring

**tsconfig.json for the SDK package:**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020"],
    "strict": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

**Key choices:**
- `target: ES2020` -- supports `BigInt` (useful for amount validation), `globalThis`, `??`, `?.`; no need for newer targets since tsdown handles final output
- `module: ESNext` -- lets tsdown handle module format conversion
- `moduleResolution: bundler` -- correct for tsdown/Rolldown pipeline
- `lib: ES2020` -- no DOM types in the SDK core; UMD browser compat handled by tsdown
- `strict: true` -- non-negotiable for a published SDK
- `isolatedModules: true` -- enables fast DTS generation via Oxc in tsdown

**Confidence:** HIGH

## Vendoring Strategy

### Base58 Decoder (~40-50 lines)

**Purpose:** Decode Solana addresses from Base58 to verify they are 32-byte Ed25519 public keys.

**Approach:** Write a minimal Base58 decoder directly in `src/vendor/base58.ts`.

**Implementation plan:** The algorithm is well-known (Bitcoin's Base58 encoding, defined 2009). A decode-only implementation requires:
1. Alphabet mapping (58 characters, no 0/O/I/l to avoid visual ambiguity)
2. Leading-zeros counting (each leading '1' = one zero byte)
3. Base conversion loop (base58 to base256)

```typescript
// Core implementation: ~35 lines of logic + comments/exports
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Decode(str: string): Uint8Array {
  // Build reverse lookup table
  const map = new Uint8Array(128);
  map.fill(255);
  for (let i = 0; i < ALPHABET.length; i++) map[ALPHABET.charCodeAt(i)] = i;

  // Count leading '1's (zero bytes in output)
  let zeros = 0;
  for (let i = 0; i < str.length && str[i] === '1'; i++) zeros++;

  // Allocate output buffer (log(58)/log(256) ~ 0.733)
  const size = Math.ceil(str.length * 733 / 1000) + 1;
  const b256 = new Uint8Array(size);

  for (let i = zeros; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    if (ch >= 128 || map[ch] === 255) throw new Error('Invalid base58 character');
    let carry = map[ch];
    for (let j = size - 1; j >= 0; j--) {
      carry += 58 * b256[j];
      b256[j] = carry % 256;
      carry = (carry / 256) | 0;
    }
  }

  // Skip leading zeros in output buffer
  let start = 0;
  while (start < size && b256[start] === 0) start++;

  const result = new Uint8Array(zeros + size - start);
  result.fill(0, 0, zeros);
  result.set(b256.subarray(start), zeros);
  return result;
}
```

**Size estimate:** ~45 lines of TypeScript including comments, <1KB minified.

**Alternatives considered:**

| Option | Size | Runtime deps | Why not |
|--------|------|--------------|---------|
| `bs58` npm | ~2KB | 1 (`base-x`) | Adds a runtime dependency; breaks zero-deps requirement |
| `base58-js` | ~560B | 0 | Could vendor, but source is ESM-only `.mjs`; our decode-only needs are simpler |
| `@scure/base` | ~5KB | 0 | Over-engineered for decode-only; includes base32, base64, bech32 we don't need |
| `bs58check` (existing site dep) | ~4KB | 2 (`bs58`, `create-hash`) | Too many transitive deps for SDK |

**Recommendation:** Write the decoder from scratch. Base58 decoding is a 35-line algorithm that hasn't changed since Bitcoin defined it in 2009. No audit risk, no license complications, trivially testable with known Solana address test vectors.

**Confidence:** HIGH -- Base58 is a simple, well-specified encoding. The algorithm is deterministic and easily verified.

### Keccak256 (~150-200 lines)

**Purpose:** EIP-55 mixed-case checksum validation for EVM addresses. The checksum algorithm hashes the lowercase hex address with keccak256, then capitalizes hex characters where the corresponding hash nibble is >= 8.

**Approach:** Vendor the Keccak-256 permutation from `@noble/hashes` with surgical extraction into `src/vendor/keccak256.ts`.

**Vendoring source analysis:**

| Source | Total file lines | Lines for keccak256 only | Internal dependencies |
|--------|-----------------|-------------------------|----------------------|
| `@noble/hashes` `sha3.ts` | ~295 lines | ~160 lines | `_u64.ts` (~105 lines), `utils.ts` (~380 lines, but only ~80 lines needed) |
| `js-sha3` | ~500 lines | ~500 lines (monolithic, all SHA3 variants included) | 0 |
| Custom from-scratch | ~150 lines | ~150 lines | 0 |

**Recommended approach: Extract from `@noble/hashes` (MIT licensed, Cure53 audited).**

Paul Miller's noble-hashes is deliberately designed to be vendorable: "The library must be auditable, with minimum amount of code, and zero dependencies." The keccak implementation is ~160 lines, which the maintainer has confirmed.

**What to extract:**
1. The Keccak permutation function (`keccakP`) with round constants -- ~70 lines
2. The 64-bit rotation helpers from `_u64.ts` (`rotlSH`, `rotlSL`, `rotlBH`, `rotlBL`, `split`) -- ~30 lines
3. A simplified sponge construction (absorb + squeeze for fixed 256-bit output only) -- ~40 lines
4. Minimal validation/utility helpers from `utils.ts` (`u32`, byte conversion) -- ~15 lines
5. A clean `keccak256(input: Uint8Array): Uint8Array` export -- ~5 lines

**Estimated vendored size:** 150-200 lines of TypeScript, ~3-4KB minified.

**The EIP-55 checksum function itself** is trivial once keccak256 exists (~15 lines):

```typescript
export function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = keccak256(new TextEncoder().encode(addr));
  let result = '0x';
  for (let i = 0; i < 40; i++) {
    const nibble = i % 2 === 0 ? (hash[i >> 1] >> 4) : (hash[i >> 1] & 0x0f);
    result += nibble >= 8 ? addr[i].toUpperCase() : addr[i];
  }
  return result;
}

export function isValidChecksumAddress(address: string): boolean {
  return address === toChecksumAddress(address);
}
```

**Why NOT use alternatives:**

| Option | Why not |
|--------|---------|
| `ethers.js` v5/v6 as dep | 500KB+ runtime dep for one function |
| `viem` as dep | Large dependency graph |
| `js-sha3` as npm dep | Adds a runtime dependency; breaks zero-deps goal |
| `Web Crypto API` (`crypto.subtle`) | Does NOT support keccak256 -- only SHA-256/384/512. Keccak is NOT SHA-3 (different padding). |
| Skip checksums entirely | Would miss meaningful validation; EIP-55 errors are common in real configs |
| `@noble/hashes` as npm dep | Would work, but adds a runtime dependency; vendoring ~200 lines is cleaner |

**Vendoring license compliance:** `@noble/hashes` is MIT licensed. Vendoring requires including the MIT license notice in the vendored file header. This is a one-line comment.

**Confidence:** MEDIUM -- The extraction approach is sound and the source is well-understood, but the exact line count depends on how much of noble-hashes' internal structure can be simplified for the single keccak256 use case. The 150-200 line estimate may be +/-30 lines. Testing against known EIP-55 test vectors from the EIP-55 specification is essential for verification.

### CAIP-2 Parsing (No Library Needed)

**Purpose:** Validate and parse `network` field values like `eip155:8453` or `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`.

**Approach:** Inline parsing -- no library.

The CAIP-2 format is: `namespace ":" reference` where:
- `namespace` matches `[-a-z]{3,16}`
- `reference` matches `[-a-zA-Z0-9]{3,47}`

This is a single regex: `/^[-a-z]{3,16}:[-a-zA-Z0-9]{3,47}$/`

**Why no library:**
- `@xlnt/caip` exists but adds a dependency for what is a one-line regex
- CAIP-2 format has been stable since 2019; no risk of spec drift
- The SDK's network registry already maps CAIP-2 IDs to metadata; parsing is just validation

**Confidence:** HIGH -- CAIP-2 spec is stable and simple.

## Monorepo Setup

### npm Workspaces

The existing project is a flat HTML/JS website at the repo root. The SDK goes in `packages/x402check/`. npm workspaces provide the simplest monorepo setup with zero additional tooling.

**Root `package.json` additions:**

```json
{
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build --workspace=packages/x402check",
    "test": "npm run test --workspace=packages/x402check",
    "test:coverage": "npm run test:coverage --workspace=packages/x402check"
  }
}
```

Note: The root `package.json` does not currently exist (website has no package.json -- it's plain HTML). One will need to be created.

**`packages/x402check/package.json`:**

```json
{
  "name": "x402check",
  "version": "1.0.0",
  "description": "Validate x402 payment configurations against the canonical spec",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.ts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "keywords": ["x402", "payment", "validation", "402", "http-402"],
  "license": "MIT"
}
```

**Why npm workspaces, not pnpm/turborepo/nx:**
- Only two conceptual packages (root website + SDK) -- zero need for build orchestration
- No inter-package dependencies (website loads SDK via CDN `<script>` tag, not workspace link)
- npm workspaces are built into npm -- no extra tooling to install or configure
- pnpm workspaces add value at 5+ packages with shared deps; overkill here
- Turborepo/Nx add value for CI caching and parallel task graphs; overkill for 1 buildable package

**Confidence:** HIGH -- npm workspaces are mature and well-documented.

### Directory Structure

```
x402check/                     # Root (existing website, unchanged)
  package.json                 # NEW: root workspace config
  .planning/
  index.html                   # Existing website (unchanged)
  input.js                     # Existing (unchanged)
  validator.js                 # Existing (replaced by SDK later)
  chains.js                    # Existing (replaced by SDK later)
  worker/                      # Existing Cloudflare Worker (unchanged)
  packages/
    x402check/                 # NEW: SDK package
      package.json
      tsdown.config.ts
      vitest.config.ts
      tsconfig.json
      src/
        index.ts               # Public API: validate, detect, normalize
        validate.ts            # Main validation orchestrator
        detect.ts              # Format detection (v2, v1, flat-legacy)
        normalize.ts           # Normalize any format to canonical v2
        types.ts               # TypeScript interfaces
        networks.ts            # CAIP-2 network registry
        assets.ts              # Known asset addresses per network
        rules/
          structure.ts         # Top-level shape validation
          requirements.ts      # PaymentRequirements field validation
          network.ts           # CAIP-2 network format validation
          address.ts           # Chain-specific address validation
          amount.ts            # Amount string validation
        vendor/
          base58.ts            # Vendored Base58 decoder (~45 lines)
          keccak256.ts         # Vendored Keccak-256 (~150-200 lines)
      tests/
        validate.test.ts
        detect.test.ts
        normalize.test.ts
        rules/
          structure.test.ts
          requirements.test.ts
          network.test.ts
          address.test.ts
          amount.test.ts
        vendor/
          base58.test.ts       # Test with known Solana address vectors
          keccak256.test.ts    # Test with known EIP-55 test vectors
        fixtures/
          valid-v2.json
          valid-v1.json
          valid-flat.json
          invalid-no-accepts.json
          invalid-bad-network.json
          real-world/
            token-data-aggregator.json
```

## Dev Dependencies (SDK package only)

| Package | Version | Purpose |
|---------|---------|---------|
| `tsdown` | `^0.20.1` | Build: ESM + CJS + UMD + DTS generation |
| `vitest` | `^4.0.17` | Test runner with watch mode |
| `typescript` | `^5.8.0` | Type checking via `tsc --noEmit` |
| `@vitest/coverage-v8` | `^4.0.17` | Code coverage reporting (v8 provider) |

**Install command:**

```bash
npm install -D tsdown vitest typescript @vitest/coverage-v8 --workspace=packages/x402check
```

**Total dev dependency count:** 4 direct packages (plus their transitive deps). No runtime dependencies.

## Runtime Dependencies

**None.** This is a hard requirement from the PRD. Everything is vendored or implemented from scratch:
- Base58 decoding: vendored (~45 lines)
- Keccak-256 hashing: vendored (~150-200 lines)
- CAIP-2 parsing: inline regex
- All validation logic: custom TypeScript

## What NOT to Add (and Why)

| Technology | Why not |
|------------|---------|
| `ethers.js` | 500KB+ for address validation achievable in ~200 vendored lines |
| `bs58` / `bs58check` | Adds runtime dep; Base58 decode is ~35 lines of logic |
| `@noble/hashes` as dep | Sound library, but adds runtime dep; we only need keccak256 |
| `js-sha3` as dep | Adds runtime dep; we only need keccak256 |
| `@xlnt/caip` | CAIP-2 parsing is a single regex -- no library needed |
| `zod` / `ajv` / `joi` | Schema validation adds 10-50KB for what is better done with hand-written rules that produce specific fix suggestions |
| `eslint` / `prettier` | Nice-to-have but not MVP; add in a follow-up milestone |
| `jest` | vitest is faster, has native TS support, does not need Babel |
| `rollup` / `webpack` / `esbuild` | tsdown wraps Rolldown; no need for another bundler |
| `turborepo` / `nx` / `lerna` | 2-package monorepo does not need build orchestration tools |
| `changesets` | Premature for v1.0.0; add when release management becomes complex |
| `husky` / `lint-staged` | Nice-to-have; not needed for initial SDK release |
| `tsup` | Unmaintained, TS 5.9 DTS issues, no native UMD; use tsdown instead |

## Bundle Size Estimates

| Output | Estimated size (minified) | Estimated size (gzipped) |
|--------|--------------------------|--------------------------|
| ESM (`index.mjs`) | ~8-12KB | ~3-4KB |
| CJS (`index.cjs`) | ~8-12KB | ~3-4KB |
| UMD (`index.umd.js`) | ~10-15KB | ~4-5KB |

**Size breakdown estimate:**
- Validation logic (rules, detect, normalize): ~4-5KB minified
- Network registry + asset registry: ~2-3KB minified
- Vendored keccak256: ~3-4KB minified
- Vendored Base58: ~0.5KB minified
- Type definitions (stripped in JS output): 0KB runtime

The PRD target of <15KB for the UMD bundle is achievable. The keccak256 vendor is the largest single component (~3-4KB minified) and is the cost of doing EIP-55 checksum validation without external dependencies.

## Alternatives Considered

### Build Tool

| Tool | Verdict | Reason |
|------|---------|--------|
| **tsdown** | RECOMMENDED | Native UMD, active development, TS 5.9 compat, Rust-based speed |
| tsup | Fallback only | Unmaintained, TS 5.9 DTS failures, no native UMD |
| Rollup + plugins | Overbuilt | Manual configuration for what tsdown handles automatically |
| esbuild direct | Missing DTS | Would need separate `tsc --emitDeclarationOnly` step |
| Vite library mode | Overbuilt | Designed for apps with assets, not pure TS libraries |

### Test Runner

| Tool | Verdict | Reason |
|------|---------|--------|
| **vitest 4.x** | RECOMMENDED | Native TS transforms, fast watch, coverage thresholds |
| Jest | Pass | Needs Babel/SWC transform for TypeScript |
| `node:test` | Pass | No coverage thresholds, limited assertion API |
| Mocha + chai | Pass | Dated ecosystem; requires separate TS transform step |

### Monorepo Tool

| Tool | Verdict | Reason |
|------|---------|--------|
| **npm workspaces** | RECOMMENDED | Built-in to npm, sufficient for 2 packages |
| pnpm workspaces | Overkill | Benefits emerge at 5+ packages with shared deps |
| Turborepo | Overkill | Task graph/caching unnecessary for 1 buildable package |
| Nx | Overkill | Enterprise-grade; massive install footprint |

### Vendoring Approach

| Approach | Verdict | Reason |
|----------|---------|--------|
| **Vendor Base58 + keccak256** | RECOMMENDED | Zero runtime deps, <15KB total, auditable |
| npm deps (bs58 + js-sha3) | Unacceptable | Breaks zero-deps requirement |
| Peer deps (ethers/viem) | Unacceptable | Forces users to install heavy crypto libraries |
| Skip deep validation | Inferior | Misses checksum errors, reduces SDK value |

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| vitest 4.x | HIGH | Current stable, 20M weekly downloads, well-documented |
| TypeScript 5.8+ | HIGH | Stable, broadly compatible |
| npm workspaces | HIGH | Mature npm feature, simple use case |
| Base58 vendor | HIGH | Simple, well-specified algorithm |
| tsdown | MEDIUM | Active and production-used, but 0.x version; tsup as fallback |
| Keccak256 vendor | MEDIUM | Sound approach, but extraction complexity needs validation during implementation |
| UMD config specifics | MEDIUM | tsdown supports UMD natively, but exact config options need verification |

## Sources

- [tsup npm](https://www.npmjs.com/package/tsup) -- v8.5.1, unmaintained, recommends tsdown
- [tsdown npm](https://www.npmjs.com/package/tsdown) -- v0.20.1 (Jan 22, 2026)
- [tsdown docs: Introduction](https://tsdown.dev/guide/) -- features, output formats
- [tsdown docs: Migrate from tsup](https://tsdown.dev/guide/migrate-from-tsup)
- [tsdown docs: Output Format](https://tsdown.dev/options/output-format) -- ESM, CJS, UMD, IIFE
- [tsdown GitHub](https://github.com/rolldown/tsdown) -- source, releases
- [vitest npm](https://www.npmjs.com/package/vitest) -- v4.0.17 (Jan 23, 2026)
- [vitest 4.0 announcement](https://vitest.dev/blog/vitest-4)
- [vitest configuration](https://vitest.dev/config/)
- [TypeScript npm](https://www.npmjs.com/package/typescript) -- v5.9.3 latest stable
- [TypeScript 5.8 release](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html)
- [@noble/hashes GitHub](https://github.com/paulmillr/noble-hashes) -- MIT, Cure53 audited, keccak in ~160 lines
- [noble-hashes discussion](https://github.com/paulmillr/noble-hashes/discussions/3) -- line count confirmation
- [base58-js GitHub](https://github.com/pur3miish/base58-js) -- ~560 bytes reference
- [EIP-55 spec](https://eips.ethereum.org/EIPS/eip-55) -- mixed-case checksum encoding
- [CAIP-2 spec](https://chainagnostic.org/CAIPs/caip-2) -- blockchain ID format
- [npm workspaces docs](https://docs.npmjs.com/cli/using-npm/workspaces)
- [tsup IIFE globalName discussion](https://github.com/egoist/tsup/discussions/1137)
- [tsup UMD issue #924](https://github.com/egoist/tsup/issues/924) -- no native UMD support
- [tsup TS 5.9 DTS issue #1369](https://github.com/egoist/tsup/issues/1369)
- [TresJS tsdown migration](https://tresjs.org/blog/tresjs-tsdown-migration) -- production adopter
- [Switching from tsup to tsdown](https://alan.norbauer.com/articles/tsdown-bundler/) -- migration experience
