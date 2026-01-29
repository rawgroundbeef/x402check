# Architecture: x402check SDK + Website Monorepo

**Domain:** TypeScript validation SDK integrated with existing HTML/JS website
**Researched:** 2026-01-29
**Milestone:** v2.0 Spec-Compliant SDK
**Overall confidence:** HIGH

## Current Architecture (Baseline)

Before defining the target, here is what exists today.

### File Map

```
x402check/                    # Repo root = website
  index.html                  # ~1,450 lines: CSS + HTML + inline JS display logic
  validator.js                # 450 lines: validateX402Config(), normalizeConfig(), detectFormat()
  chains.js                   # 91 lines: CHAINS registry, isKnownChain(), getChainType()
  input.js                    # 187 lines: detectInputType(), testX402Url(), handleValidation()
  worker/
    proxy.js                  # 147 lines: Cloudflare Worker CORS proxy
  .planning/                  # GSD planning files
```

### Current Data Flow

```
User input (URL or JSON)
    |
    v
input.js: detectInputType()
    |
    +--[URL]--> input.js: testX402Url() --> worker/proxy.js (CF Worker)
    |               |
    |               v
    |           HTTP 402 response --> extract config from body or PAYMENT-REQUIRED header
    |               |
    +--[JSON]-------+
    |
    v
validator.js: validateX402Config(configTextOrObject)
    |
    +-- JSON.parse (if string)
    +-- normalizeConfig() --> detectFormat() + field alias resolution
    +-- per-payment validation loop:
    |     chain check (hardcoded SUPPORTED_CHAINS)
    |     address check (regex + ethers.utils.getAddress for EVM checksum)
    |     amount check (normalizeAmount with micro-units heuristic)
    |     asset check (CHAIN_ASSETS allowlist)
    +-- marketplace checks (outputSchema, metadata)
    |
    v
ValidationResult { valid, errors[], warnings[], detectedFormat, normalized, version }
    |
    v
index.html: displayResults() --> renderVerdict() + renderDetails()
```

### Key Dependencies (Browser Globals)

| Global | Source | Size | Purpose |
|--------|--------|------|---------|
| `ethers` | CDN: ethers v5.7.2 UMD | ~800KB | `ethers.utils.getAddress()` for EIP-55 checksum |
| `bs58` | CDN: bs58 v6.0.0 UMD | ~10KB | Not currently used in validator.js (only loaded) |

**Critical observation:** The current `validator.js` only uses `ethers.utils.getAddress()` -- a single function from an 800KB library. The `bs58` import is loaded but never called from `validator.js` (the validator uses regex-only for Solana). This confirms the PRD decision to vendor minimal crypto primitives.

---

## Target Architecture

### Monorepo Structure

```
x402check/                          # Repo root
  package.json                      # Root workspace config (NEW)
  packages/
    x402check/                      # SDK package (NEW)
      src/
        index.ts                    # Public API: export { validate, detect, normalize }
        validate.ts                 # Main orchestrator
        detect.ts                   # Format detection (v2, v1, flat-legacy, unknown)
        normalize.ts                # Any format --> canonical v2 shape
        types.ts                    # All TypeScript interfaces
        networks.ts                 # CAIP-2 network registry
        assets.ts                   # Known asset addresses per network
        rules/
          structure.ts              # Level 1: JSON parsing, object check, format recognition
          version.ts                # Level 2: x402Version, accepts array, resource object
          requirements.ts           # Level 3: scheme, network format, amount, asset, payTo
          network.ts                # Level 4a: CAIP-2 format, known network lookup
          address.ts                # Level 4b: Chain-specific address validation
          amount.ts                 # Level 3/4: Numeric string, positive, format
        crypto/
          base58.ts                 # Vendored Base58 decoder (~50 lines)
          keccak.ts                 # Vendored keccak256 for EIP-55 (~160 lines)
          checksum.ts               # EIP-55 toChecksumAddress using keccak
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
        fixtures/
          valid-v2.json
          valid-v1.json
          valid-flat.json
          invalid-*.json
          real-world/
      dist/                         # Build output (gitignored)
        index.mjs                   # ESM
        index.cjs                   # CJS
        index.d.ts                  # TypeScript declarations
        index.d.mts                 # ESM declarations
        x402check.global.js         # IIFE browser bundle
      package.json
      tsconfig.json
      tsup.config.ts
      vitest.config.ts
  index.html                        # Website (MODIFIED -- swap script tags)
  validator.js                       # RETIRED -- replaced by SDK
  chains.js                          # RETIRED -- replaced by SDK
  input.js                           # MODIFIED -- calls SDK instead of validator.js
  worker/
    proxy.js                         # UNCHANGED
```

### Root package.json (NEW)

```json
{
  "name": "x402check-monorepo",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "build": "npm -w packages/x402check run build",
    "test": "npm -w packages/x402check run test",
    "dev": "npm -w packages/x402check run dev"
  }
}
```

**Rationale:** npm workspaces require `private: true` at root. The root package.json only orchestrates -- it has no dependencies itself. The website (plain HTML files at root) is NOT a workspace; it does not need a package.json. Only `packages/x402check/` is a workspace.

**Confidence:** HIGH -- this is standard npm workspaces pattern. Verified via [npm workspaces documentation](https://docs.npmjs.com/cli/v10/using-npm/workspaces) and multiple real-world monorepo examples.

### SDK package.json

```json
{
  "name": "x402check",
  "version": "1.0.0",
  "description": "Validate x402 payment configurations against the canonical spec",
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
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
    "build": "tsup",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "tsup": "^8.5",
    "vitest": "^3.0"
  },
  "keywords": ["x402", "payment", "validation", "402", "http-402"],
  "license": "MIT"
}
```

**Zero runtime dependencies.** All crypto primitives (Base58, keccak256) are vendored into `src/crypto/`. Dev dependencies are TypeScript tooling only.

---

## Build Pipeline

### tsup Configuration

```typescript
// packages/x402check/tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig([
  // Node builds: ESM + CJS + declarations
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    outDir: 'dist',
    clean: true,
    splitting: false,
    sourcemap: true,
    target: 'es2020',
  },
  // Browser build: IIFE for <script> tag
  {
    entry: ['src/index.ts'],
    format: ['iife'],
    outDir: 'dist',
    globalName: 'x402Validate',
    outExtension: () => ({ js: '.global.js' }),
    platform: 'browser',
    minify: true,
    sourcemap: true,
    target: 'es2020',
  },
]);
```

**Key decisions:**

1. **IIFE, not UMD.** tsup uses esbuild under the hood, which supports `iife` format natively but not true UMD. IIFE with `globalName` achieves the same result for browser `<script>` usage: the exports are available at `window.x402Validate`. True UMD (AMD + CJS + global) is unnecessary because the npm `exports` field handles Node consumption, and the IIFE handles browser consumption. The PRD says "UMD" but IIFE is the correct implementation path.

2. **Array config.** Two separate build configs because the browser build needs different options: `platform: 'browser'`, `minify: true`, `globalName`, and a custom output extension (`.global.js` instead of `.js` to avoid filename collisions with CJS output).

3. **`outExtension: () => ({ js: '.global.js' })`** produces `dist/index.global.js` for the browser bundle, distinct from `dist/index.cjs` and `dist/index.mjs`.

4. **`target: 'es2020'`** ensures compatibility with browsers shipping since ~2020 (covers all relevant browsers) while allowing modern syntax (nullish coalescing, optional chaining).

**Confidence:** HIGH -- verified against [tsup official docs](https://tsup.egoist.dev/), [MSW tsup.config.ts](https://github.com/mswjs/msw/blob/main/tsup.config.ts), and [tsup IIFE issue #1290](https://github.com/egoist/tsup/issues/1290).

### Build Outputs

```
dist/
  index.mjs           # ESM  -- import { validate } from 'x402check'
  index.cjs           # CJS  -- const { validate } = require('x402check')
  index.d.ts          # CJS type declarations
  index.d.mts         # ESM type declarations
  index.global.js     # IIFE -- <script src="..."> exposes window.x402Validate
  index.global.js.map # Source map for browser debugging
```

### UMD/IIFE Global Exposure

When loaded via `<script>` tag, the IIFE bundle creates:

```javascript
window.x402Validate = {
  validate: function(input, options?) { ... },
  detect: function(input) { ... },
  normalize: function(input) { ... },
  // Also exposed for advanced usage:
  VERSION: '1.0.0',
};
```

**How this works:** tsup's `globalName: 'x402Validate'` wraps all `index.ts` exports in an IIFE that assigns them to `window.x402Validate`. The `export { validate, detect, normalize }` in `index.ts` becomes properties of the global object.

---

## Validation Pipeline Architecture

### The validate() Orchestrator

The core architectural pattern is a **layered validation pipeline** where each level runs independently but later levels may be skipped if earlier levels produce fatal errors.

```
validate(input, options?)
    |
    v
[Level 0: Parse]
    JSON.parse if string
    Type check: must be object
    Early exit: INVALID_JSON, NOT_OBJECT
    |
    v
[Level 1: Detect Format]
    detect(parsed) --> 'v2' | 'v1' | 'flat-legacy' | 'unknown'
    Early exit: UNKNOWN_FORMAT
    |
    v
[Level 2: Normalize]
    normalize(parsed, format) --> NormalizedConfig
    Maps any format to canonical v2 shape
    Records legacy warnings (FLAT_FORMAT, V1_FIELD_NAMES, etc.)
    |
    v
[Level 3: Structure Validation]
    rules/structure.ts: check x402Version, accepts array, resource
    Errors: MISSING_VERSION, INVALID_VERSION, MISSING_ACCEPTS
    Warnings: MISSING_RESOURCE, INVALID_RESOURCE_URL
    |
    v
[Level 4: Field Validation] (per accepts entry)
    rules/requirements.ts: scheme, amount, asset, payTo, maxTimeoutSeconds
    Errors: MISSING_SCHEME, MISSING_AMOUNT, INVALID_AMOUNT, etc.
    |
    v
[Level 5: Network Validation] (per accepts entry)
    rules/network.ts: CAIP-2 format check, known network lookup
    rules/address.ts: chain-type-specific address validation
    rules/amount.ts: deep amount validation (if not caught at L4)
    Errors: INVALID_NETWORK_FORMAT, INVALID_EVM_ADDRESS, ADDRESS_NETWORK_MISMATCH
    Warnings: UNKNOWN_NETWORK, UNKNOWN_ASSET, BAD_EVM_CHECKSUM
    |
    v
[Aggregate]
    Collect all errors + warnings from all levels
    Return ValidationResult
```

### Level Skip Logic

```typescript
// validate.ts pseudocode
function validate(input: unknown, options?: ValidateOptions): ValidationResult {
  const issues: ValidationIssue[] = [];

  // Level 0: Parse
  const parsed = parseInput(input);
  if (parsed.error) return earlyResult(parsed.error);

  // Level 1: Detect
  const format = detect(parsed.value);
  if (format === 'unknown') return earlyResult(unknownFormatError());

  // Level 2: Normalize (always succeeds if format is known)
  const { normalized, warnings: normWarnings } = normalize(parsed.value, format);
  issues.push(...normWarnings);

  // Level 3: Structure
  issues.push(...validateStructure(normalized, format));

  // Level 4+5: Per-entry validation (only if accepts exists)
  if (normalized.accepts) {
    for (let i = 0; i < normalized.accepts.length; i++) {
      const entry = normalized.accepts[i];
      const path = `accepts[${i}]`;

      issues.push(...validateRequirements(entry, path, format));
      issues.push(...validateNetwork(entry, path));
      issues.push(...validateAddress(entry, path));
      issues.push(...validateAmount(entry, path));
    }
  }

  // Aggregate
  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    version: format,
    errors: issues.filter(i => i.severity === 'error'),
    warnings: issues.filter(i => i.severity === 'warning'),
    normalized: normalized,
  };
}
```

**Design rationale for NOT using Chain of Responsibility:** The classic Chain of Responsibility pattern (each handler decides whether to pass to the next) adds abstraction without benefit here. The validation levels are not interchangeable; they have a fixed, known order. A simple sequential pipeline with explicit level functions is clearer, more debuggable, and more testable. Each rule function is a pure function: `(entry, path) => ValidationIssue[]`.

### Rule Function Signature

Every rule function follows the same interface:

```typescript
// Each rule file exports one or more functions matching this pattern:
type RuleFunction = (entry: NormalizedRequirements, path: string) => ValidationIssue[];

// Structure rules operate on the full config:
type StructureRuleFunction = (config: NormalizedConfig, format: DetectedFormat) => ValidationIssue[];
```

This uniformity makes rules composable, testable in isolation, and trivially extensible. Adding a new rule is: write a function with this signature, call it from validate.ts.

---

## Component Boundaries

### New Components (SDK)

| Component | File | Responsibility | Inputs | Outputs |
|-----------|------|----------------|--------|---------|
| Public API | `index.ts` | Re-exports validate, detect, normalize | - | - |
| Orchestrator | `validate.ts` | Runs pipeline, aggregates results | `unknown`, `ValidateOptions?` | `ValidationResult` |
| Detector | `detect.ts` | Identifies format from raw parsed object | `object` | `DetectedFormat` |
| Normalizer | `normalize.ts` | Maps any format to canonical v2 shape | `object`, `DetectedFormat` | `NormalizedConfig`, `ValidationIssue[]` |
| Types | `types.ts` | All interfaces and type definitions | - | - |
| Network Registry | `networks.ts` | CAIP-2 network data, name lookups | - | const data |
| Asset Registry | `assets.ts` | Known asset addresses per network | - | const data |
| Structure Rules | `rules/structure.ts` | L3: version, accepts, resource checks | `NormalizedConfig`, `DetectedFormat` | `ValidationIssue[]` |
| Requirements Rules | `rules/requirements.ts` | L4: per-field required checks | `NormalizedRequirements`, `string` | `ValidationIssue[]` |
| Network Rules | `rules/network.ts` | L5: CAIP-2 format, known network | `NormalizedRequirements`, `string` | `ValidationIssue[]` |
| Address Rules | `rules/address.ts` | L5: chain-specific address validation | `NormalizedRequirements`, `string` | `ValidationIssue[]` |
| Amount Rules | `rules/amount.ts` | L4: amount string validation | `NormalizedRequirements`, `string` | `ValidationIssue[]` |
| Base58 | `crypto/base58.ts` | Pure JS Base58 decode | `string` | `Uint8Array` |
| Keccak | `crypto/keccak.ts` | Pure JS keccak-256 hash | `Uint8Array` | `Uint8Array` |
| Checksum | `crypto/checksum.ts` | EIP-55 toChecksumAddress | `string` | `string` |

### Modified Components (Website)

| Component | File | Change | Details |
|-----------|------|--------|---------|
| HTML | `index.html` | Script tags replaced | Remove ethers.js + bs58 CDN. Remove chains.js + validator.js. Add SDK IIFE bundle. Keep input.js. |
| Input Handler | `input.js` | Minimal API update | `validateX402Config(x)` --> `x402Validate.validate(x)`. Result shape mapping. |
| Display Logic | `index.html` (inline JS) | Adapt to new result shape | Map SDK's `ValidationResult` to existing display functions |

### Unchanged Components

| Component | File | Why Unchanged |
|-----------|------|---------------|
| CORS Proxy | `worker/proxy.js` | SDK does not do network calls. Proxy remains website-only concern. |

---

## Integration Points

### 1. Website Script Tag Replacement

**Before (current):**
```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js" ...></script>
<script src="https://cdn.jsdelivr.net/npm/bs58@6.0.0/dist/index.umd.js" ...></script>
<script src="chains.js"></script>
<script src="validator.js"></script>
<script src="input.js"></script>
```

**After (SDK integrated):**
```html
<script src="https://cdn.jsdelivr.net/npm/x402check@latest/dist/index.global.js"></script>
<script src="input.js"></script>
```

Five `<script>` tags become two. Total external load drops from ~810KB (ethers alone is ~800KB) to an estimated ~15-20KB (SDK IIFE bundle).

### 2. input.js API Bridge

The `input.js` file currently calls `validateX402Config()` (a global from `validator.js`). After integration, it calls `x402Validate.validate()` (a global from the SDK IIFE).

**Current call site (input.js line 120):**
```javascript
validation = validateX402Config(config);
```

**After:**
```javascript
validation = x402Validate.validate(config);
```

**Current call site (input.js line 164):**
```javascript
const validation = validateX402Config(inputValue);
```

**After:**
```javascript
const validation = x402Validate.validate(inputValue);
```

### 3. Result Shape Mapping

The SDK returns a different `ValidationResult` shape than the current `validateX402Config()`. The display logic in `index.html` needs adaptation.

**Current shape:**
```javascript
{
  valid: boolean,
  errors: [{ field, message, fix }],
  warnings: [{ field, message, fix }],
  detectedFormat: 'flat' | 'v1' | 'v2' | 'v2-marketplace',
  normalized: { x402Version, payments: [{ chain, address, asset, minAmount, _normalizedAmount }] },
  version: number
}
```

**SDK shape:**
```javascript
{
  valid: boolean,
  version: 'v2' | 'v1' | 'flat-legacy',
  errors: [{ code, field, message, fix, severity }],
  warnings: [{ code, field, message, fix, severity }],
  normalized: { x402Version, accepts: [{ scheme, network, amount, asset, payTo, maxTimeoutSeconds }] }
}
```

**Breaking changes in result shape:**

| Current | SDK | Mapping needed |
|---------|-----|----------------|
| `detectedFormat` | `version` | Rename in display code |
| `normalized.payments` | `normalized.accepts` | Rename in display code |
| `payments[].chain` | `accepts[].network` | CAIP-2 format, display needs update |
| `payments[].address` | `accepts[].payTo` | Rename in display code |
| `payments[].minAmount` | `accepts[].amount` | Rename in display code |
| `payments[]._normalizedAmount` | Not present | Remove micro-unit display logic |
| `error.field` is short name | `error.field` is JSON path | May need formatting |
| No `code` on issues | `code` present | Can use for programmatic handling |
| Format values: `flat`, `v1`, `v2`, `v2-marketplace` | `flat-legacy`, `v1`, `v2` | Update format labels map |

**Recommendation:** Create a thin adapter function in `input.js` that maps SDK result to the display shape, rather than rewriting all display code. This minimizes website changes and keeps the integration incremental.

```javascript
// input.js addition
function adaptResult(sdkResult) {
  return {
    valid: sdkResult.valid,
    errors: sdkResult.errors,
    warnings: sdkResult.warnings,
    detectedFormat: sdkResult.version === 'flat-legacy' ? 'flat' : sdkResult.version,
    normalized: sdkResult.normalized ? {
      x402Version: sdkResult.normalized.x402Version,
      payments: (sdkResult.normalized.accepts || []).map(a => ({
        chain: a.network,
        address: a.payTo,
        asset: a.asset,
        minAmount: a.amount,
      }))
    } : null,
    version: sdkResult.normalized?.x402Version || 1,
  };
}
```

### 4. Example Configs Update

The example configs in `index.html` (lines 1157-1198) use the old field names (`payments`, `address`, `chain`, `minAmount`). These must be updated to canonical v2 format with CAIP-2 network identifiers.

### 5. V2 Equivalent Display

The current `generateV2Equivalent()` function in `validator.js` generates the old "v2" format. This function is replaced by `x402Validate.normalize()`, which returns canonical v2. The "Show v2 equivalent" button in the UI should call `normalize()` directly.

---

## Crypto Vendoring Strategy

### Base58 Decoder

**Recommendation:** Vendor `base58-js` (~560 bytes minified, zero dependencies) or write a minimal ~50-line decoder.

The algorithm for Base58 decoding is straightforward:
1. Map each character to its Base58 alphabet position
2. Multiply-and-add through a big-number accumulator (represented as a Uint8Array)
3. Handle leading `1` characters (which represent leading zero bytes)

**Vendoring approach:** Copy the decode-only portion into `src/crypto/base58.ts`. The encode direction is not needed (the SDK only validates addresses, never creates them). This keeps the contribution to bundle size under 500 bytes minified.

**Confidence:** HIGH -- Base58 decoding is a well-defined algorithm. The [base58-js](https://github.com/pur3miish/base58-js) implementation at ~560 bytes total (encode + decode) confirms the size estimate. Decode-only will be smaller.

### Keccak-256 (for EIP-55)

**Recommendation:** Use `@noble/hashes/sha3` as a dev dependency and let tsup bundle it, or vendor the keccak implementation directly.

**Option A: Bundle @noble/hashes/sha3 (RECOMMENDED)**
- Import only `keccak_256` from `@noble/hashes/sha3`
- tsup will tree-shake and bundle it into the output
- The sha3 module from @noble/hashes is ~160 lines, estimated ~7-10KB minified
- Audited by a firm funded by Ethereum Foundation
- This is technically a runtime dependency but since tsup bundles it, the published package has zero `dependencies` in package.json
- List it as a `devDependency` since it is bundled at build time

**Option B: Vendor js-sha3**
- Single file, ~600 lines, zero dependencies
- More code to maintain in-repo
- Not independently audited

**Option C: Vendor minimal keccak (~200 lines)**
- Write or copy the keccak-f[1600] permutation + sponge construction
- Smallest possible bundle contribution
- Risk of subtle bugs in cryptographic code

**Decision:** Option A. The security audit of `@noble/hashes` and the ergonomics of `import { keccak_256 } from '@noble/hashes/sha3'` outweigh the minor size difference. tsup bundles it into the output, so the published package still has zero runtime `dependencies`. The `@noble/hashes` package is explicitly designed for this use case -- Paul Millr's noble libraries are the standard for audited, minimal JS crypto.

**Confidence:** HIGH for the approach. MEDIUM for exact bundle size (estimated 7-10KB for keccak portion; would need a test build to confirm).

### EIP-55 Checksum

The checksum algorithm itself is trivial once keccak-256 is available:

```typescript
// src/crypto/checksum.ts (~15 lines)
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex } from '@noble/hashes/utils';

export function toChecksumAddress(address: string): string {
  const addr = address.toLowerCase().replace('0x', '');
  const hash = bytesToHex(keccak_256(new TextEncoder().encode(addr)));
  let checksummed = '0x';
  for (let i = 0; i < addr.length; i++) {
    checksummed += parseInt(hash[i], 16) >= 8
      ? addr[i].toUpperCase()
      : addr[i];
  }
  return checksummed;
}
```

This replaces the entire 800KB `ethers.js` dependency with ~15 lines + ~7KB of bundled keccak.

---

## Type System

### Core Types (types.ts)

```typescript
// Format detection result
export type DetectedFormat = 'v2' | 'v1' | 'flat-legacy' | 'unknown';

// Validation issue (error or warning)
export interface ValidationIssue {
  code: string;           // Machine-readable: 'MISSING_SCHEME', 'INVALID_NETWORK_FORMAT'
  field: string;          // JSON path: 'accepts[0].network'
  message: string;        // Human-readable explanation
  fix?: string;           // Actionable suggestion
  severity: 'error' | 'warning';
}

// Main result
export interface ValidationResult {
  valid: boolean;
  version: DetectedFormat;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  normalized: NormalizedConfig | null;
}

// Canonical v2 shape (normalization target)
export interface NormalizedConfig {
  x402Version: number;
  resource?: { url: string; description?: string; mimeType?: string };
  accepts: NormalizedRequirements[];
  extensions?: Record<string, unknown>;
}

export interface NormalizedRequirements {
  scheme: string;
  network: string;        // CAIP-2 format
  amount: string;         // Atomic units string
  asset: string;          // Contract address or symbol
  payTo: string;          // Recipient address
  maxTimeoutSeconds?: number;
  extra?: Record<string, unknown>;
}

// Options for validate()
export interface ValidateOptions {
  strict?: boolean;       // Warnings become errors
  addressValidator?: (address: string, networkType: string) => boolean;
}

// Network registry entry
export interface NetworkInfo {
  name: string;
  type: 'evm' | 'solana' | 'stellar' | 'aptos';
  testnet: boolean;
}
```

### Type Flow Through Pipeline

```
Input: unknown
  |
  v  (JSON.parse or passthrough)
Parsed: object  (untyped -- we don't know the shape yet)
  |
  v  (detect)
Format: DetectedFormat
  |
  v  (normalize)
Config: NormalizedConfig  (typed -- we now know the canonical shape)
  |
  v  (validate rules)
Issues: ValidationIssue[]
  |
  v  (aggregate)
Result: ValidationResult  (typed -- consumer's interface)
```

---

## Network/Chain Extensibility

### CAIP-2 Registry Pattern

```typescript
// networks.ts
export const NETWORKS: Record<string, NetworkInfo> = {
  'eip155:8453':  { name: 'Base',           type: 'evm',    testnet: false },
  'eip155:84532': { name: 'Base Sepolia',   type: 'evm',    testnet: true },
  'eip155:1':     { name: 'Ethereum',       type: 'evm',    testnet: false },
  'eip155:11155111': { name: 'Sepolia',     type: 'evm',    testnet: true },
  'eip155:43114': { name: 'Avalanche',      type: 'evm',    testnet: false },
  // Solana
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': { name: 'Solana Mainnet', type: 'solana', testnet: false },
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': { name: 'Solana Devnet',  type: 'solana', testnet: true },
  // Stellar, Aptos -- include in registry, address validation deferred
  'stellar:pubnet':  { name: 'Stellar Mainnet', type: 'stellar', testnet: false },
  'aptos:1':         { name: 'Aptos Mainnet',   type: 'aptos',   testnet: false },
};
```

### Address Validation Dispatch

```typescript
// rules/address.ts
function validateAddressForNetwork(
  address: string,
  networkId: string,
  networkType: string
): ValidationIssue[] {
  switch (networkType) {
    case 'evm':
      return validateEvmAddress(address, networkId);
    case 'solana':
      return validateSolanaAddress(address, networkId);
    default:
      // For stellar, aptos, etc.: skip deep validation, accept any non-empty string
      return [];
  }
}
```

**Extensibility path:** Adding a new chain type requires:
1. Add entries to `NETWORKS` in `networks.ts`
2. Add a `case` to the switch in `rules/address.ts`
3. Implement the chain-specific validation function
4. (Optional) Add entries to `ASSETS` in `assets.ts`

This is intentionally simple. A plugin/registry pattern would be over-engineering for 4-6 chain types.

### Simple Name Mapping (Legacy Support)

```typescript
// networks.ts
export const SIMPLE_NAME_MAP: Record<string, string> = {
  'base':          'eip155:8453',
  'base-sepolia':  'eip155:84532',
  'ethereum':      'eip155:1',
  'solana':        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  'solana-devnet': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
};
```

Used during normalization: if a config uses `network: "base"` instead of `network: "eip155:8453"`, the normalizer maps it and emits a `SIMPLE_CHAIN_NAME` warning.

---

## Anti-Patterns to Avoid

### 1. Do NOT use Zod/Valibot for schema validation

**Why not:** These libraries are designed for runtime type checking with static type inference. The x402check SDK needs custom validation logic with detailed error codes, field paths, and fix suggestions that schema libraries cannot express. Zod would add ~57KB to the bundle for functionality that is worse than hand-written rules for this use case.

**Instead:** Pure functions returning `ValidationIssue[]`. Each rule is a simple function that checks conditions and returns issues. This is more testable, more debuggable, and produces better error messages.

### 2. Do NOT over-abstract the rule system

**Why not:** A generic "rule registry" with dynamic registration, priorities, and dependency resolution is unnecessary for ~10 rules that will rarely change. It adds indirection without value.

**Instead:** Direct function calls in `validate.ts`. The "registry" is just the import list. Adding a rule means adding an import and a function call.

### 3. Do NOT separate address validation into chain-specific packages

**Why not:** The x402 spec currently supports 4 chain types (EVM, Solana, Stellar, Aptos). Each address validator is 10-30 lines. Separate packages for each chain would create packaging overhead that dwarfs the code itself.

**Instead:** All chain validation in `rules/address.ts` with a simple switch statement. If the number of supported chains grows to 20+, revisit this decision.

### 4. Do NOT make the SDK async

**Why not:** All validation is pure computation on in-memory data. No I/O, no network calls, no file system access. Making `validate()` async would complicate the API for consumers and the UMD browser build for zero benefit.

**Instead:** All public API functions are synchronous. The website's `input.js` handles async concerns (URL fetching via proxy) separately from validation.

---

## Scalability Considerations

| Concern | At current scale | At 100+ rules | At 50+ chain types |
|---------|-----------------|---------------|---------------------|
| Rule organization | Single validate.ts orchestrator | Split into rule groups by category | Same pattern, more cases |
| Bundle size | ~15-20KB IIFE | ~25-30KB | ~30-40KB (registry data grows) |
| Test suite | ~100 cases, <1s | ~500 cases, <5s | Same framework, more fixtures |
| Chain extensibility | switch in address.ts | Still switch, more cases | Consider registry pattern |

None of these scale points require architectural changes. The simple function-based approach scales well into the hundreds of rules.

---

## Suggested Build Order (Phase Implications)

Based on the dependency graph, the recommended build order is:

### Phase 1: SDK Foundation
Build the type system, detection, and normalization first. These have no external dependencies and establish the data contracts.

**Files:** `types.ts`, `detect.ts`, `normalize.ts`, `networks.ts`, `assets.ts`
**Tests:** `detect.test.ts`, `normalize.test.ts`
**Why first:** Everything else depends on types and normalization. Detection is the entry point that determines all subsequent validation behavior.

### Phase 2: Validation Rules
Build rules bottom-up (leaf rules first, then orchestrator).

**Files:** `rules/structure.ts`, `rules/requirements.ts`, `rules/amount.ts`, `rules/network.ts`, `crypto/base58.ts`, `crypto/keccak.ts`, `crypto/checksum.ts`, `rules/address.ts`, `validate.ts`, `index.ts`
**Tests:** All rule tests, `validate.test.ts`
**Why this order:** Crypto primitives enable address validation. Structure and requirements are independent. The orchestrator (`validate.ts`) wires them together last.

### Phase 3: Build Pipeline
Configure tsup, verify all output formats, test browser bundle.

**Files:** `tsup.config.ts`, `tsconfig.json`, `vitest.config.ts`, `package.json`
**Why after code:** Build config is easier to debug with working code. Iterate on config until all three outputs (ESM, CJS, IIFE) work correctly.

### Phase 4: Website Integration
Replace website's script tags, adapt input.js, update examples.

**Files:** `index.html` (script tags + examples), `input.js` (API bridge), retire `validator.js` + `chains.js`
**Why last:** Requires published or locally-built SDK bundle. Keeps the existing website working until the SDK is proven.

---

## CDN Distribution Strategy

### During Development

The website loads the IIFE bundle from the local build:

```html
<!-- Development: relative path to built SDK -->
<script src="packages/x402check/dist/index.global.js"></script>
```

### After npm Publish

The website loads from jsDelivr CDN:

```html
<!-- Production: CDN with version pinning -->
<script src="https://cdn.jsdelivr.net/npm/x402check@1.0.0/dist/index.global.js"></script>
```

jsDelivr automatically serves any file from an npm package's `files` field. Since `"files": ["dist"]` is in package.json, `dist/index.global.js` is available immediately after `npm publish`.

### SRI Hash

After the first publish, add a Subresource Integrity hash:

```html
<script src="https://cdn.jsdelivr.net/npm/x402check@1.0.0/dist/index.global.js"
        integrity="sha384-[hash]"
        crossorigin="anonymous"></script>
```

This matches the current pattern used for ethers.js and bs58 in the existing index.html.

---

## Sources

- [tsup official documentation](https://tsup.egoist.dev/) -- format options, globalName, IIFE builds
- [MSW tsup.config.ts](https://github.com/mswjs/msw/blob/main/tsup.config.ts) -- real-world IIFE + globalName example
- [tsup IIFE issue #1290](https://github.com/egoist/tsup/issues/1290) -- IIFE global property access pattern
- [tsup jsDocs API](https://www.jsdocs.io/package/tsup) -- defineConfig accepts Options[]
- [npm workspaces docs](https://docs.npmjs.com/cli/v10/using-npm/workspaces) -- private: true, workspace syntax
- [dual publishing ESM/CJS with tsup](https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong) -- package.json exports field
- [@noble/hashes GitHub](https://github.com/paulmillr/noble-hashes) -- audited keccak, tree-shakeable, ~160 lines sha3
- [base58-js GitHub](https://github.com/pur3miish/base58-js) -- ~560 byte pure JS Base58
- [EIP-55 specification](https://eips.ethereum.org/EIPS/eip-55) -- EVM address checksum algorithm
- [CAIP-2 specification](https://chainagnostic.org/CAIPs/caip-2) -- blockchain ID format (namespace:reference)
- [coinbase/x402 specification](https://github.com/coinbase/x402/blob/main/specs/x402-specification.md) -- canonical PaymentRequirements schema
- [x402 V2 announcement](https://www.x402.org/writing/x402-v2-launch) -- V2 schema changes
