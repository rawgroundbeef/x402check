# Feature Landscape: x402check Validation SDK

**Domain:** Protocol validation SDK (npm package for x402 PaymentRequired response validation)
**Researched:** 2026-01-29
**Confidence:** HIGH (cross-referenced Zod, Ajv, libphonenumber-js, multicoin-address-validator patterns with x402 spec from coinbase/x402 repo)

## Context

This research is for the **v2.0 SDK milestone** -- extracting validation logic from the x402check website into a standalone npm package. The SDK validates x402 PaymentRequired responses (v1, v2, and flat-legacy formats). This document supersedes the v1.0 website-focused feature research.

---

## Table Stakes

Features consumers expect from any validation SDK. Missing these means the SDK feels incomplete or amateur.

### TS-1: Core `validate()` API Returning Structured Results

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Every validation library (Zod, Ajv, Valibot) returns structured results, not thrown errors |
| **Complexity** | MEDIUM |
| **Pattern** | Zod's `safeParse()` returns `{ success, data, error }` discriminated union. Ajv returns `{ valid, errors }`. Both avoid throwing on invalid input. |
| **Recommendation** | Return `{ valid: boolean, errors: ValidationIssue[], warnings: ValidationIssue[], version, normalized }`. Use the non-throwing pattern -- validation SDKs must never throw on invalid input. Throwing should be reserved for programmer errors (e.g., passing wrong argument types), not for invalid data. |
| **Dependencies** | Requires ValidationIssue type, format detection, normalization |
| **Existing** | Current `validateX402Config()` already returns this shape. Needs cleanup and TypeScript types. |

### TS-2: Machine-Readable Error Codes

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Zod uses `ZodIssueCode` (`invalid_type`, `invalid_string`, etc.). Ajv uses `keyword` (`required`, `type`, `pattern`). Consumers need codes to programmatically react to errors, not parse human-readable strings. |
| **Complexity** | LOW |
| **Pattern** | String enum or `as const` object. Codes like `MISSING_SCHEME`, `INVALID_NETWORK_FORMAT`, `BAD_EVM_CHECKSUM`. |
| **Recommendation** | Use SCREAMING_SNAKE_CASE string constants (not TypeScript `enum`) exported as `const ErrorCode = { ... } as const`. String enums don't tree-shake well; `as const` objects do. Zod v4 moved away from enums for this reason. |
| **Dependencies** | None -- foundational type |
| **Existing** | Current code uses ad-hoc message strings with no codes. Must be built from scratch. |

### TS-3: Field Path in Error Reports

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Zod provides `path: (string | number)[]` (e.g., `['accepts', 0, 'network']`). Ajv uses JSON pointer format. All modern validators locate errors precisely. |
| **Complexity** | LOW |
| **Pattern** | Use string path format (e.g., `accepts[0].network`) rather than array format. String paths are simpler to read in CLI output and JSON logs. Ajv supports both, but string paths are more common in domain-specific validators. |
| **Recommendation** | `field: string` with dot-notation paths. Use bracket notation for array indices: `accepts[0].network`, `accepts[1].payTo`. |
| **Dependencies** | Must be threaded through all validation rules |
| **Existing** | Current code uses partial paths like `payments[0].chain`. Needs CAIP-2 field name updates but pattern exists. |

### TS-4: Human-Readable Error Messages

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Every validator provides `message: string`. Users should be able to display these directly. |
| **Complexity** | LOW |
| **Pattern** | Zod: `"Expected string, received number"`. libphonenumber-js: `"TOO_SHORT"`. For domain-specific validators, messages should use domain language: `"Network must use CAIP-2 format (e.g., 'eip155:8453')"`. |
| **Recommendation** | Each error code maps to a default message template. Messages should be complete sentences that a developer unfamiliar with x402 can understand. |
| **Dependencies** | Requires error code definitions |
| **Existing** | Current messages are decent but inconsistent. Needs standardization. |

### TS-5: `detect()` API for Format Identification

| Aspect | Detail |
|--------|--------|
| **Why Expected** | libphonenumber-js detects country from number. bitcoin-address-validation has `getAddressInfo()`. Format detection without full validation is a fundamental operation. |
| **Complexity** | LOW |
| **Pattern** | Pure function: `detect(input) => 'v2' | 'v1' | 'flat-legacy' | 'unknown'`. No side effects, no mutation. Should accept string or object. |
| **Recommendation** | Implement as described in PRD. Fast, lightweight -- only examines structure (has `accepts`? has `x402Version`?), does not validate field values. |
| **Dependencies** | JSON parsing (if string input) |
| **Existing** | `detectFormat()` exists in current code. Needs updating for correct v1/v2 distinction (current code thinks `payments` is v2 but spec uses `accepts`). |

### TS-6: TypeScript Type Definitions

| Aspect | Detail |
|--------|--------|
| **Why Expected** | All modern npm packages ship `.d.ts` files. TypeScript adoption in the x402 ecosystem is universal (the official @x402/core is TypeScript). |
| **Complexity** | LOW (if written in TypeScript from the start) |
| **Pattern** | Export interfaces for all public types: `ValidationResult`, `ValidationIssue`, `NormalizedConfig`, etc. Mirror the x402 spec types where appropriate. |
| **Recommendation** | Write the SDK in TypeScript. Export types from `index.d.ts`. Align type names with @x402/core where possible (e.g., `PaymentRequirements` matches their naming). |
| **Dependencies** | Build system (tsup) generates declarations |
| **Existing** | Current code is plain JavaScript. Must be rewritten in TypeScript. |

### TS-7: JSON String and Object Input Support

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Validators must handle both parsed objects and raw strings. Zod accepts any input. Ajv's `validate()` accepts objects. x402 configs arrive as JSON strings (from headers) or objects (from parsed responses). |
| **Complexity** | LOW |
| **Pattern** | Accept `string | object` for all public APIs. If string, parse as JSON first. If parsing fails, return `INVALID_JSON` error. |
| **Recommendation** | All three public functions (`validate`, `detect`, `normalize`) should accept `string | Record<string, unknown>`. JSON parse errors are reported as the first validation error. |
| **Dependencies** | None |
| **Existing** | Current `validateX402Config()` already handles both. Carry forward. |

### TS-8: Layered Validation (Structure then Fields then Network)

| Aspect | Detail |
|--------|--------|
| **Why Expected** | Ajv validates schema structure before evaluating constraints. Zod validates outer types before inner refinements. Returning "invalid network format" when the entire structure is unparseable is confusing. |
| **Complexity** | MEDIUM |
| **Pattern** | Validate in ordered layers: (1) JSON parseable? (2) Recognized format? (3) Required fields present? (4) Field values valid? (5) Network-specific checks. Short-circuit on structural errors -- don't report field-level errors if structure is unrecognizable. |
| **Recommendation** | Five layers as defined in PRD: Structure -> Version/Shape -> PaymentRequirements fields -> Network-specific -> Legacy format warnings. Each layer produces errors/warnings independently. |
| **Dependencies** | All validation rules organized by layer |
| **Existing** | Current code has implicit layering (parse JSON, detect format, validate fields). Needs explicit layer separation. |

---

## Differentiators

Features that set x402check SDK apart from generic validators. Not expected in all SDKs, but provide concrete competitive advantage for this domain.

### DF-1: Actionable Fix Suggestions

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Most validators say "invalid". x402check says "Use 'eip155:8453' instead of 'base'". This is the SDK's core UX advantage. |
| **Complexity** | MEDIUM |
| **Pattern** | `fix?: string` field on ValidationIssue. libphonenumber-js normalizes to E.164 and shows what the valid format looks like. bitcoin-address-validation provides `getAddressInfo()` with details. The pattern is: when you know what the user *meant*, tell them the correct form. |
| **Recommendation** | Include `fix` on every error where the correct value can be inferred. For `SIMPLE_CHAIN_NAME`: `"Use 'eip155:8453' instead of 'base'"`. For `BAD_EVM_CHECKSUM`: `"Use '0xAbC...' (checksummed)"`. For `V1_FIELD_NAMES`: `"Use 'amount' instead of 'maxAmountRequired'"`. |
| **Dependencies** | Network registry (for chain name mapping), address validation (for checksum correction) |
| **Existing** | Current code has `fix` field. Needs expansion and consistency. |

### DF-2: Errors vs Warnings Distinction

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Generic validators (Zod, Ajv) only have errors. x402check distinguishes blocking issues (config won't work) from advisory issues (config works but is suboptimal). This maps directly to ESLint's error/warn/off pattern. |
| **Complexity** | LOW |
| **Pattern** | ESLint: `"error"` (exit code 1), `"warn"` (report but pass), `"off"` (ignore). Ajv strict mode: violations either throw or log depending on config. The pattern is: errors mean "this config will fail at runtime", warnings mean "this config works but violates best practices or uses deprecated formats". |
| **Recommendation** | Every ValidationIssue has `severity: 'error' | 'warning'`. Examples: missing `payTo` = error (config will fail); using flat format = warning (config works but should upgrade); unknown network = warning (might be a new chain we don't recognize yet). `valid` is true only when `errors.length === 0`. Warnings do not affect `valid`. |
| **Dependencies** | None -- fundamental to ValidationIssue type |
| **Existing** | Current code already separates errors and warnings arrays. Carry forward. |

### DF-3: `normalize()` API -- Any Format to Canonical v2

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | libphonenumber-js normalizes phone numbers to E.164. Address validators normalize to checksummed format. x402check normalizes flat-legacy and v1 configs to canonical v2 shape. This lets consumers always work with one format internally. |
| **Complexity** | MEDIUM |
| **Pattern** | `normalize(input) => NormalizedConfig | null`. Returns null if input is too broken to normalize (unknown format). Normalization should be idempotent -- normalizing an already-v2 config returns the same shape. |
| **Recommendation** | Implement as described in PRD. Key mappings: flat `payTo/amount/network/currency` -> v2 `accepts[]`. v1 `maxAmountRequired` -> v2 `amount`. Simple chain names -> CAIP-2 identifiers. Always returns canonical v2 shape with `x402Version: 2`, `accepts[]`, `resource`. |
| **Dependencies** | Format detection (DF-5), chain name registry |
| **Existing** | `normalizeConfig()` exists but normalizes to wrong field names (`payments` instead of `accepts`). Needs rewrite. |

### DF-4: Strict Mode (Warnings Become Errors)

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Ajv has `strict: true | false | "log"`. ESLint has `--max-warnings 0`. TypeScript has `strict: true`. CI/CD pipelines need a way to enforce that all warnings are resolved. x402check strict mode makes this trivial. |
| **Complexity** | LOW |
| **Pattern** | `validate(config, { strict: true })` -- warnings are promoted to errors. `valid` becomes false if any warnings exist. The Ajv pattern is ideal: strict mode doesn't change what is detected, only the severity of what was already found. |
| **Recommendation** | Accept options as second argument: `validate(config, { strict?: boolean })`. When `strict: true`, post-process the result: move all warnings to errors, set `valid = false` if any existed. This is a ~10-line wrapper, not a deep architectural change. |
| **Dependencies** | Errors vs warnings distinction (DF-2) must be implemented first |
| **Existing** | Not implemented. Mentioned as open question in PRD. Recommend including. |

### DF-5: x402 Spec-Aware Format Detection

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Not just "is this valid JSON?" but "what version of x402 is this?" Detects v2 (with `accepts` + `x402Version: 2` + `resource`), v1 (with `accepts`), flat-legacy (root-level fields), and unknown formats. No other tool does this. |
| **Complexity** | LOW |
| **Pattern** | Decision tree as defined in PRD: has `accepts`? -> has `x402Version: 2` + `resource`? -> v2. Otherwise -> v1. No `accepts`? -> has root-level `payTo`/`amount`? -> flat-legacy. Otherwise -> unknown. |
| **Recommendation** | Fast, cheap function. Does not validate field values -- only examines structural markers. Returns immediately on first match. |
| **Dependencies** | None |
| **Existing** | `detectFormat()` exists but uses wrong field names (checks for `payments` array, which is not in the spec). Needs rewrite for spec correctness. |

### DF-6: Extensible Chain Validation Registry

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | multicoin-address-validator uses `chainType` option to validate unknown tokens. The x402 spec supports new chains through CAIP-2. An extensible registry means the community can add new chains without forking the SDK. |
| **Complexity** | MEDIUM |
| **Pattern** | Two approaches from the ecosystem: (1) multicoin-address-validator's `chainType` fallback -- validate unknown tokens using known chain type's address format. (2) fastest-validator's `v.plugin(myPlugin)` -- register custom validators. For x402check, approach (1) is cleaner: validate by CAIP-2 namespace (`eip155:*` uses EVM rules, `solana:*` uses Solana rules). |
| **Recommendation** | Default registry covers known networks (Base, Base Sepolia, Avalanche, Solana mainnet/devnet/testnet, Stellar, Aptos). Unknown networks with recognized CAIP-2 namespace (`eip155:*`, `solana:*`) get validated by namespace rules. Custom validators can be passed via options: `validate(config, { networkValidators: { 'eip155': myEvmValidator } })`. |
| **Dependencies** | CAIP-2 parsing, network registry data structure |
| **Existing** | Current code has hardcoded `SUPPORTED_CHAINS` array. Needs architectural change to registry pattern. |

### DF-7: Normalized Result Always Included

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | validate() returns `normalized: NormalizedConfig | null` alongside errors. Even if there are warnings, users get a canonical v2 shape they can use directly. This reduces the common two-step pattern of validate-then-normalize to a single call. |
| **Complexity** | LOW (once normalize() is built) |
| **Pattern** | Inspired by Zod's `safeParse()` which returns `data` alongside the success flag. The normalized result is the "cleaned" version of the input, available even when validation produces warnings. |
| **Recommendation** | `normalized` is `null` only when the input is completely unparseable (invalid JSON, unknown format). If there are only warnings, normalized is always populated. This means consumers can write: `const { valid, normalized } = validate(config); if (normalized) useIt(normalized);` |
| **Dependencies** | normalize() function |
| **Existing** | Current code returns `normalized` on the result. Carry forward and formalize. |

### DF-8: Known Asset Registry per Network

| Aspect | Detail |
|--------|--------|
| **Value Proposition** | Validates that asset addresses are recognized for the specified network. Catches common mistakes like using Base USDC address on Solana. |
| **Complexity** | LOW |
| **Pattern** | Static lookup table: `{ 'eip155:8453': { 'USDC': '0x833589...' } }`. When `asset` field matches a known symbol, verify the address. When `asset` is an address, check if it's known for the network. Unknown assets get a warning, not an error. |
| **Recommendation** | Ship with known assets from the x402 ecosystem (USDC on Base, Base Sepolia, Solana mainnet, Solana devnet). Unknown assets produce `UNKNOWN_ASSET` warning. Users can augment via options if needed. |
| **Dependencies** | Network registry (DF-6) |
| **Existing** | `CHAIN_ASSETS` exists in current code. Needs CAIP-2 key format and expansion. |

---

## Anti-Features

Features to deliberately NOT build. Common requests or assumptions that would harm the SDK.

### AF-1: Network Calls of Any Kind

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Making HTTP requests to verify facilitator liveness, resolve asset addresses, or test endpoints | Validation must be synchronous, offline-capable, and side-effect-free. Network calls add latency, failure modes, and make the SDK unsuitable for CI/CD, browser, and serverless environments. Ajv and Zod are both purely synchronous for validation. | All validation is pure function computation. The SDK operates on static data (the config object) and static registries (known networks/assets). If users need liveness checks, they build that on top. |

### AF-2: Payment Payload Construction or Signing

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Building payment payloads, signing transactions, or interacting with wallets | This is @x402/core's job. x402check validates *configs*, not *payments*. Adding this would create dependency on ethers.js, web3.js, or @solana/web3.js, destroying the zero-dependency goal. | Clearly document scope: "x402check answers 'is this 402 config correct?' It does not construct or send payments." |

### AF-3: On-Chain Verification

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Verifying that asset contracts exist on-chain, checking balances, or confirming facilitator registration | Requires RPC connections, chain-specific SDKs, and introduces async complexity. The Coinbase facilitator handles settlement verification. | Keep validation offline. If an asset address "looks valid" for its network type, that's sufficient. Flag unknown assets as warnings. |

### AF-4: Schema-First Validation (Zod/Ajv Under the Hood)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Using Zod or Ajv as the validation engine internally | Adds runtime dependency (Zod is ~13KB min, Ajv is ~30KB). The x402 spec has ~20 validation rules total -- a schema library is overkill. Domain-specific validation (CAIP-2 parsing, EVM checksums, Base58 decoding) cannot be expressed as JSON Schema or Zod schemas anyway. The PRD targets <15KB UMD bundle. | Write validation rules as plain TypeScript functions. Each rule is a function that receives a value and context, returns `ValidationIssue[]`. This is simpler, smaller, and more debuggable than schema DSLs. |

### AF-5: Configurable Rule Severity

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Letting users configure individual rules as error/warning/off (ESLint-style) | ESLint has 300+ rules; per-rule configuration makes sense. x402check has ~20 rules; per-rule configuration is over-engineering. It also means users can silence critical errors (`MISSING_PAY_TO` as "off"), producing configs that will fail at runtime. | Provide only `strict: true/false`. Strict promotes all warnings to errors. Individual rules have fixed severity based on spec requirements. If `payTo` is missing, it's always an error, period. |

### AF-6: Async Validation

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Making validate() return a Promise | All validation logic is synchronous. Introducing async would force consumers to `await` every call, complicating usage in synchronous contexts (Express middleware, CLI tools, template rendering). Zod's `safeParse()` is synchronous; `safeParseAsync()` exists only for async refinements. | Keep all public APIs synchronous. If users need async operations (fetching config from URL, then validating), they handle the async part themselves: `const config = await fetch(url); const result = validate(config);` |

### AF-7: Mutable State or Singleton Pattern

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Global validator instance that accumulates state or configuration | Creates hidden coupling, makes testing harder, and prevents parallel usage. fastest-validator uses `new Validator()` instances, which is better than singletons but still unnecessary for stateless validation. | Pure functions. `validate()`, `detect()`, `normalize()` are stateless. Options are passed per-call. No global configuration, no `new Validator()`, no `.configure()`. |

### AF-8: Custom Error Message Templates

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| i18n support, custom message formatting, or message template overrides | Zod v4 unified error maps. Ajv has `ajv-i18n`. These make sense for form validation SDKs used by end-users. x402check consumers are developers building x402 integrations -- they read English error messages in development/CI. | Ship one set of clear English messages. Consumers who need different messaging can map error codes to their own messages: `const myMessage = errorCodeToMessage[issue.code]`. The machine-readable code is the stable API; the message is for convenience. |

---

## Feature Dependencies

```
[TS-2: Error Codes]
    |
    +---> [TS-3: Field Paths] -----+
    |                              |
    +---> [TS-4: Messages] --------+---> [TS-1: validate() API]
    |                              |           |
    +---> [DF-1: Fix Suggestions] -+           +---> [DF-7: Normalized in Result]
                                               |           |
[TS-5: detect() API] ----+                     |     [DF-3: normalize() API]
                          |                    |
[TS-8: Layered Rules] ---+---> [DF-2: Errors/Warnings] ---> [DF-4: Strict Mode]
                          |
[DF-6: Chain Registry] --+---> [DF-8: Asset Registry]
                          |
                          +---> [DF-1: Fix Suggestions (chain name mapping)]
```

### Key Dependency Insights

1. **Error codes (TS-2) are foundational** -- every other feature references them. Build first.
2. **detect() (TS-5) is independently useful** and a prerequisite for validate() and normalize().
3. **Strict mode (DF-4) is a thin wrapper** -- build after errors/warnings distinction works.
4. **Chain/asset registries (DF-6, DF-8) are data, not logic** -- can be built in parallel with validation rules.
5. **normalize() (DF-3) and validate() (TS-1) share detection logic** -- detect() is the shared foundation.

---

## MVP Recommendation

### Phase 1: Foundation (Must Ship)

All table stakes features (TS-1 through TS-8) plus these differentiators:

1. **TS-1: validate() with structured results** -- the core API
2. **TS-2: Machine-readable error codes** -- stable API for programmatic consumers
3. **TS-3: Field paths** -- locate errors in the config
4. **TS-4: Human messages** -- developer-readable output
5. **TS-5: detect()** -- format identification
6. **TS-6: TypeScript types** -- first-class TS support
7. **TS-7: String/object input** -- flexible input handling
8. **TS-8: Layered validation** -- sensible error ordering
9. **DF-1: Fix suggestions** -- the primary differentiator
10. **DF-2: Errors vs warnings** -- severity distinction
11. **DF-3: normalize()** -- format conversion
12. **DF-5: Spec-aware detection** -- x402-specific intelligence

### Phase 2: Enhancement (Ship Shortly After)

13. **DF-4: Strict mode** -- CI/CD enforcement (low effort, high value)
14. **DF-6: Extensible chain registry** -- community contribution path
15. **DF-7: Normalized result in validate()** -- convenience API
16. **DF-8: Asset registry** -- known asset validation

### Defer Indefinitely

All anti-features (AF-1 through AF-8). These represent scope that belongs elsewhere or adds complexity without proportionate value.

---

## Patterns from Real Validation Libraries

### Pattern 1: Zod's safeParse() -- The Gold Standard

```typescript
// Zod pattern (what consumers expect)
const result = schema.safeParse(data);
if (!result.success) {
  result.error.issues.forEach(issue => {
    console.log(issue.code);    // 'invalid_type'
    console.log(issue.path);    // ['accepts', 0, 'network']
    console.log(issue.message); // 'Expected string, received number'
  });
}

// x402check equivalent
const result = validate(config);
if (!result.valid) {
  result.errors.forEach(issue => {
    console.log(issue.code);    // 'INVALID_NETWORK_FORMAT'
    console.log(issue.field);   // 'accepts[0].network'
    console.log(issue.message); // 'Network must use CAIP-2 format'
    console.log(issue.fix);     // 'Use "eip155:8453" instead of "base"'
  });
}
```

### Pattern 2: Ajv's Strict Mode -- Configurable Severity

```typescript
// Ajv pattern
const ajv = new Ajv({ strict: true });     // throws on violations
const ajv = new Ajv({ strict: "log" });    // warns on violations
const ajv = new Ajv({ strict: false });    // ignores violations

// x402check equivalent
const result = validate(config, { strict: true });  // warnings become errors
const result = validate(config);                     // default: warnings stay warnings
```

### Pattern 3: libphonenumber-js -- Detect/Validate/Normalize Trifecta

```typescript
// libphonenumber-js pattern
const phone = parsePhoneNumber('+14155552671');
phone.isValid();              // validate
phone.country;                // detect
phone.formatInternational();  // normalize

// x402check equivalent
detect(config);               // 'v2' | 'v1' | 'flat-legacy' | 'unknown'
validate(config);             // { valid, errors, warnings, normalized }
normalize(config);            // canonical v2 shape or null
```

### Pattern 4: multicoin-address-validator -- Chain-Type Extensibility

```typescript
// multicoin-address-validator pattern
WAValidator.validate(address, 'UNKNOWN_TOKEN', { chainType: 'ethereum' });

// x402check equivalent -- validate by CAIP-2 namespace
// Built-in: 'eip155:8453' -> uses EVM address validation
// Unknown: 'eip155:99999' -> still uses EVM rules (same namespace)
// Custom: validate(config, { networkValidators: { 'mychain': myValidator } })
```

### Pattern 5: ESLint -- Error vs Warning Severity

```typescript
// ESLint pattern
// "semi": "error"   -> fails CI
// "semi": "warn"    -> reported but passes
// "semi": "off"     -> ignored

// x402check equivalent
// MISSING_PAY_TO: always error (config will fail)
// FLAT_FORMAT: always warning (config works, but suboptimal)
// strict: true -> all warnings become errors
```

---

## Complexity Summary

| Feature | Complexity | Effort Estimate | Notes |
|---------|-----------|-----------------|-------|
| TS-1: validate() | MEDIUM | 2-3 days | Core orchestration of all rules |
| TS-2: Error codes | LOW | 0.5 days | Type definitions + constants |
| TS-3: Field paths | LOW | 0.5 days | Thread path through rules |
| TS-4: Messages | LOW | 1 day | Write ~25 message templates |
| TS-5: detect() | LOW | 0.5 days | Simple decision tree |
| TS-6: TypeScript types | LOW | 1 day | Interfaces + exports |
| TS-7: String/object input | LOW | 0.5 days | JSON.parse wrapper |
| TS-8: Layered validation | MEDIUM | 2 days | 5 rule layers, short-circuit logic |
| DF-1: Fix suggestions | MEDIUM | 1-2 days | Per-error inference logic |
| DF-2: Errors vs warnings | LOW | 0.5 days | Severity field on issues |
| DF-3: normalize() | MEDIUM | 2 days | Format-specific mapping logic |
| DF-4: Strict mode | LOW | 0.5 days | Post-process wrapper |
| DF-5: Spec-aware detection | LOW | 0.5 days | Already partially built |
| DF-6: Chain registry | MEDIUM | 1-2 days | Registry data structure + CAIP-2 parser |
| DF-7: Normalized in result | LOW | 0.5 days | Call normalize() inside validate() |
| DF-8: Asset registry | LOW | 0.5 days | Static lookup table |

**Total estimated effort:** 14-17 developer-days for all features

---

## Sources

**Validation Library API Patterns:**
- [Zod - TypeScript-first schema validation](https://zod.dev/) -- safeParse(), ZodIssue structure, error customization [HIGH confidence]
- [Zod error formatting](https://zod.dev/error-formatting) -- treeifyError, issue path semantics [HIGH confidence]
- [Ajv JSON Schema validator - strict mode](https://ajv.js.org/strict-mode.html) -- strict: true/false/"log" pattern [HIGH confidence]
- [Ajv options](https://ajv.js.org/options.html) -- allErrors, verbose error reporting [HIGH confidence]
- [Valibot - modular schema library](https://valibot.dev/) -- parse/safeParse/is pattern, tree-shaking [HIGH confidence]

**Blockchain Address Validation:**
- [multicoin-address-validator on npm](https://www.npmjs.com/package/multicoin-address-validator) -- chainType extensibility pattern [HIGH confidence]
- [bitcoin-address-validation on npm](https://www.npmjs.com/package/bitcoin-address-validation) -- validate + getAddressInfo pattern [HIGH confidence]

**x402 Protocol Specification:**
- [coinbase/x402 GitHub](https://github.com/coinbase/x402) -- PaymentRequirements type definitions, spec structure [HIGH confidence]
- [x402 V2 Launch Announcement](https://www.x402.org/writing/x402-v2-launch) -- v1 vs v2 differences, CAIP-2 adoption [HIGH confidence]
- [Coinbase Developer Documentation - x402](https://docs.cdp.coinbase.com/x402/welcome) -- official SDK types and usage [HIGH confidence]
- [CAIP-2 Specification](https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-2.md) -- namespace:reference format [HIGH confidence]

**Phone Number Validation (detect/validate/normalize trifecta):**
- [libphonenumber-js on npm](https://www.npmjs.com/package/libphonenumber-js) -- parsePhoneNumber, isValid, formatInternational [HIGH confidence]

**TypeScript Patterns:**
- [Discriminated Unions in TypeScript](https://dev.to/tigawanna/understanding-discriminated-unions-in-typescript-1n0h) -- Result pattern for type-safe errors [MEDIUM confidence]
- [ESLint Rule Configuration](https://eslint.org/docs/latest/use/configure/rules) -- error/warn/off severity pattern [HIGH confidence]
- [fastest-validator plugin pattern](https://github.com/icebob/fastest-validator) -- v.plugin() extensibility [MEDIUM confidence]

---
*Feature research for: x402check SDK (v2.0 milestone)*
*Researched: 2026-01-29*
*Confidence: HIGH (patterns verified against official library documentation and x402 spec)*
