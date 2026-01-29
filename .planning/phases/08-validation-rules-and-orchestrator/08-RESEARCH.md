# Phase 8: Validation Rules and Orchestrator - Research

**Researched:** 2026-01-29
**Domain:** Validation orchestration and rule composition
**Confidence:** HIGH

## Summary

This phase completes the SDK by implementing a validation orchestrator that composes multiple validation rule modules into a single `validate()` API. The orchestrator follows a pipeline pattern where validation rules are organized by level (structure → version/shape → fields → network-specific → legacy warnings) and executed in sequence, collecting all errors and warnings before returning a structured result.

The standard approach in modern TypeScript validation libraries is to:
1. Separate validation concerns into discrete rule modules (structure, fields, network, amount, legacy)
2. Compose them through an orchestrator that accumulates errors rather than failing fast
3. Return rich ValidationResult objects with field paths, error codes, human messages, and fix suggestions
4. Support strict mode to promote warnings to errors for CI/CD pipelines

Previous phases have built the foundation: error codes (Phase 6), detection/normalization (Phase 6), crypto primitives (Phase 7), and address validation (Phase 7). This phase integrates them into the public-facing `validate()` API.

**Primary recommendation:** Use a pipeline pattern with rule modules that return ValidationIssue arrays, orchestrated by validate() which calls normalize(), then runs rule validators in sequence, accumulating all issues, and promotes warnings to errors if strict mode is enabled.

## Standard Stack

The established libraries/tools for validation orchestration:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | 4.0+ | Test runner | Already in use, Jest-compatible API, 10-20× faster than Jest for ESM projects |
| TypeScript | 5.9+ | Type system | Already in use, enables compile-time validation of error codes and result types |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None needed | - | Zero runtime deps | All validation logic is custom TypeScript code |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom orchestrator | Zod/Yup/Joi | Zod is TypeScript-first with schema composition, but adds ~10KB runtime dependency and requires rewriting all validation logic to match Zod schema API. Custom orchestrator keeps zero runtime deps and full control over error messages. |
| Custom rule modules | FluentValidation-ts | FluentValidation-ts provides chainable API, but requires learning library-specific patterns. Custom modules are simpler for this domain-specific validation. |
| Vitest | Jest | Jest is more mature but slower for ESM projects. Vitest already integrated in Phase 6, has Jest-compatible API for easy migration. |

**Installation:**
No new dependencies needed. All validation logic uses existing TypeScript, built-in primitives, and Phase 6-7 utilities.

## Architecture Patterns

### Recommended Project Structure
```
packages/x402check/src/
├── validation/
│   ├── rules/
│   │   ├── structure.ts      # Level 1: JSON parsing, format detection
│   │   ├── version.ts         # Level 2: x402Version, accepts, resource
│   │   ├── fields.ts          # Level 3: scheme, network, amount, asset, payTo
│   │   ├── network.ts         # Level 4: CAIP-2 format, known networks
│   │   ├── amount.ts          # Level 4: numeric string, positive, non-zero
│   │   ├── legacy.ts          # Level 5: flat format, v1 fields, simple names
│   │   └── index.ts           # Export all rule validators
│   ├── orchestrator.ts        # Compose rules into validate() pipeline
│   └── index.ts               # Public API exports
├── types/
│   ├── validation.ts          # ValidationResult, ValidationIssue (Phase 6)
│   └── errors.ts              # ErrorCode, ErrorMessages (Phase 6)
└── index.ts                   # Re-export validate() as public API

test/
├── validation/
│   ├── rules/
│   │   ├── structure.test.ts
│   │   ├── version.test.ts
│   │   ├── fields.test.ts
│   │   ├── network.test.ts
│   │   ├── amount.test.ts
│   │   └── legacy.test.ts
│   └── orchestrator.test.ts   # Integration tests
├── fixtures/
│   ├── valid-v2-base.json
│   ├── valid-v2-solana.json
│   ├── valid-v1.json
│   ├── valid-flat.json
│   ├── invalid-no-accepts.json
│   ├── invalid-bad-network.json
│   └── real-world/
│       └── token-data-aggregator.json
└── integration.test.ts        # End-to-end validate() tests
```

### Pattern 1: Validation Pipeline with Error Accumulation
**What:** Orchestrator executes validation rules in sequence, collecting all errors/warnings before returning
**When to use:** When users need comprehensive feedback (all errors at once), not fail-fast behavior

**Example:**
```typescript
// Source: Error accumulation pattern from validation libraries
export interface ValidationOptions {
  strict?: boolean | undefined
}

export function validate(
  input: string | object,
  options?: ValidationOptions
): ValidationResult {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // Level 1: Parse and detect format
  const { parsed, error: parseError } = parseInput(input)
  if (parseError) {
    return {
      valid: false,
      version: 'unknown',
      errors: [parseError],
      warnings: [],
      normalized: null,
    }
  }

  const version = detect(parsed as object)
  if (version === 'unknown') {
    errors.push({
      code: ErrorCode.UNKNOWN_FORMAT,
      field: '$',
      message: ErrorMessages.UNKNOWN_FORMAT,
      severity: 'error',
    })
    return { valid: false, version: 'unknown', errors, warnings, normalized: null }
  }

  // Normalize before validation
  const normalized = normalize(parsed as object)
  if (!normalized) {
    errors.push({
      code: ErrorCode.UNKNOWN_FORMAT,
      field: '$',
      message: ErrorMessages.UNKNOWN_FORMAT,
      severity: 'error',
    })
    return { valid: false, version, errors, warnings, normalized: null }
  }

  // Level 2-5: Run rule validators, accumulating issues
  errors.push(...validateVersion(normalized, version))
  errors.push(...validateAccepts(normalized))
  errors.push(...validateResource(normalized, version))

  // Only validate fields if accepts array exists
  if (normalized.accepts) {
    normalized.accepts.forEach((entry, index) => {
      const fieldPath = `accepts[${index}]`
      errors.push(...validateFields(entry, fieldPath))
      warnings.push(...validateNetwork(entry, fieldPath))
      warnings.push(...validateAsset(entry, fieldPath))

      // Address validation from Phase 7
      if (entry.payTo && entry.network) {
        const addressIssues = validateAddress(entry.payTo, entry.network, `${fieldPath}.payTo`)
        addressIssues.forEach(issue => {
          if (issue.severity === 'error') errors.push(issue)
          else warnings.push(issue)
        })
      }
    })
  }

  warnings.push(...validateLegacyFormat(normalized, version))

  // Strict mode: promote warnings to errors
  if (options?.strict === true) {
    warnings.forEach(w => {
      errors.push({ ...w, severity: 'error' })
    })
    warnings.length = 0
  }

  return {
    valid: errors.length === 0,
    version,
    errors,
    warnings,
    normalized,
  }
}
```

### Pattern 2: Rule Module Structure
**What:** Each rule module exports a validator function that returns ValidationIssue[]
**When to use:** For all validation rules - keeps concerns separated, enables unit testing

**Example:**
```typescript
// Source: Validation pattern from FluentValidation and Zod approaches
// packages/x402check/src/validation/rules/fields.ts

import type { AcceptsEntry, ValidationIssue } from '../../types'
import { ErrorCode, ErrorMessages } from '../../types/errors'

/**
 * Validate required fields in an accepts entry
 * Level 3 validation
 */
export function validateFields(entry: AcceptsEntry, fieldPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  // scheme
  if (!entry.scheme) {
    issues.push({
      code: ErrorCode.MISSING_SCHEME,
      field: `${fieldPath}.scheme`,
      message: ErrorMessages.MISSING_SCHEME,
      severity: 'error',
    })
  }

  // network
  if (!entry.network) {
    issues.push({
      code: ErrorCode.MISSING_NETWORK,
      field: `${fieldPath}.network`,
      message: ErrorMessages.MISSING_NETWORK,
      severity: 'error',
    })
  }

  // amount
  if (!entry.amount) {
    issues.push({
      code: ErrorCode.MISSING_AMOUNT,
      field: `${fieldPath}.amount`,
      message: ErrorMessages.MISSING_AMOUNT,
      severity: 'error',
    })
  }

  // asset
  if (!entry.asset) {
    issues.push({
      code: ErrorCode.MISSING_ASSET,
      field: `${fieldPath}.asset`,
      message: ErrorMessages.MISSING_ASSET,
      severity: 'error',
    })
  }

  // payTo
  if (!entry.payTo) {
    issues.push({
      code: ErrorCode.MISSING_PAY_TO,
      field: `${fieldPath}.payTo`,
      message: ErrorMessages.MISSING_PAY_TO,
      severity: 'error',
    })
  }

  return issues
}
```

### Pattern 3: Test Organization with Describe Blocks
**What:** Organize tests hierarchically: validation level → rule type → specific case
**When to use:** Always - makes test output readable and debugging easier with 100+ test cases

**Example:**
```typescript
// Source: Vitest test organization best practices
import { describe, test, expect } from 'vitest'
import { validate } from '../src/validation/orchestrator'

describe('validate()', () => {
  describe('Level 1: Structure validation', () => {
    describe('INVALID_JSON', () => {
      test('returns error for invalid JSON string', () => {
        const result = validate('not json')
        expect(result.valid).toBe(false)
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]?.code).toBe('INVALID_JSON')
      })
    })

    describe('NOT_OBJECT', () => {
      test('returns error for JSON array', () => {
        const result = validate('[]')
        expect(result.valid).toBe(false)
        expect(result.errors[0]?.code).toBe('NOT_OBJECT')
      })
    })
  })

  describe('Level 2: Version validation', () => {
    describe('MISSING_VERSION', () => {
      test('error for v2 config without x402Version', () => {
        const result = validate({
          accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' }],
          resource: { url: 'https://example.com' },
        })
        expect(result.errors.some(e => e.code === 'MISSING_VERSION')).toBe(true)
      })

      test('warning for flat-legacy without x402Version', () => {
        const result = validate({
          payTo: '0xdef',
          amount: '100',
          network: 'eip155:8453',
          asset: '0xabc',
        })
        // flat-legacy normalizes to v2 with x402Version: 2, so no missing version error
        expect(result.warnings.some(w => w.code === 'LEGACY_FORMAT')).toBe(true)
      })
    })
  })

  describe('strict mode', () => {
    test('promotes warnings to errors when strict: true', () => {
      const config = {
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        amount: '100',
        network: 'base', // simple name → warning
        asset: 'USDC',
      }
      const lenient = validate(config)
      expect(lenient.valid).toBe(true)
      expect(lenient.warnings.length).toBeGreaterThan(0)

      const strict = validate(config, { strict: true })
      expect(strict.valid).toBe(false)
      expect(strict.errors.length).toBeGreaterThan(0)
      expect(strict.warnings).toHaveLength(0)
    })
  })
})
```

### Pattern 4: JSON Fixture-Based Testing
**What:** Store test configs as JSON files, load in tests for reproducibility
**When to use:** For real-world configs, regression testing, and sharing test data

**Example:**
```typescript
// Source: Jest/Vitest fixture testing patterns
import { describe, test, expect } from 'vitest'
import { validate } from '../src/validation/orchestrator'
import validV2Base from './fixtures/valid-v2-base.json'
import validV1 from './fixtures/valid-v1.json'
import tokenDataAgg from './fixtures/real-world/token-data-aggregator.json'

describe('fixture-based tests', () => {
  test('valid-v2-base.json passes validation', () => {
    const result = validate(validV2Base)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.version).toBe('v2')
  })

  test('valid-v1.json passes with normalization', () => {
    const result = validate(validV1)
    expect(result.valid).toBe(true)
    expect(result.normalized?.x402Version).toBe(2)
  })

  test('token-data-aggregator.json (real-world flat-legacy)', () => {
    const result = validate(tokenDataAgg)
    expect(result.warnings.some(w => w.code === 'LEGACY_FORMAT')).toBe(true)
    expect(result.normalized?.x402Version).toBe(2)
  })
})
```

### Anti-Patterns to Avoid
- **Fail-fast validation:** Don't stop at first error. Users need to see all validation issues to fix them in one pass. Collect all errors before returning.
- **Magic string error codes:** Don't use string literals for error codes. Use the ErrorCode const object (Phase 6) with `satisfies Record<>` enforcement for type safety.
- **Tight coupling:** Don't put all validation logic in one file. Separate by concern (structure, fields, network, amount, legacy) for testability.
- **Missing field paths:** Don't return errors without `field` property. Include JSON path like `accepts[0].network` so users know exactly what's wrong.
- **Warnings without fix suggestions:** Don't return warnings without actionable guidance. Include `fix` property like "Use 'eip155:8453' instead of 'base'".

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JSON parsing with error handling | try/catch around JSON.parse | parseInput() utility (Phase 6) | Already handles JSON parsing, type guards, returns ParsedInput with error |
| Format detection | Custom heuristics | detect() function (Phase 6) | Already implemented with v2/v1/flat-legacy detection |
| Normalization | Manual field mapping | normalize() function (Phase 6) | Already handles all format conversions with extensions preservation |
| Address validation | Regex + Base58 libraries | validateAddress() (Phase 7) | Already implements EVM checksum, Solana Base58, CAIP-2 dispatch |
| CAIP-2 format checking | String.includes(':') | isValidCaip2() (Phase 6) | Already validates namespace:reference format |
| Network registry lookup | Hard-coded if/else | getNetworkNamespace() (Phase 6) | Already maps CAIP-2 to namespace with known networks |
| Error message templates | String concatenation | ErrorMessages const (Phase 6) | Already provides human-readable messages for all error codes |

**Key insight:** Phases 6-7 built all the primitives. This phase only needs to orchestrate them into a pipeline. Don't reimplement what's already tested and working.

## Common Pitfalls

### Pitfall 1: Validating Unnormalized Input
**What goes wrong:** Running validation rules against raw input formats (v1, flat-legacy) leads to complex conditional logic handling different field names
**Why it happens:** Intuition says "validate first, normalize later" but normalized configs have consistent field names
**How to avoid:** Always normalize before validation. Validation rules operate on NormalizedConfig shape (v2 canonical format)
**Warning signs:** if (version === 'v1') checks in validation rules, maxAmountRequired vs amount conditionals

### Pitfall 2: Modifying Warnings Array in Strict Mode
**What goes wrong:** Strict mode moves warnings to errors, but if you splice/mutate the warnings array, array indices break
**Why it happens:** forEach with array mutation causes skipped elements
**How to avoid:** Create new error objects from warnings, then clear warnings array: `warnings.forEach(w => errors.push({ ...w, severity: 'error' })); warnings.length = 0`
**Warning signs:** Flaky tests where strict mode sometimes has non-empty warnings array

### Pitfall 3: Running Field Validation When Accepts Array Missing
**What goes wrong:** Accessing normalized.accepts[0] when accepts is undefined or empty causes runtime errors
**Why it happens:** Validation assumes normalized config is structurally sound
**How to avoid:** Guard field validation with if (normalized.accepts) check. Structure errors are already collected, don't crash on field validation.
**Warning signs:** "Cannot read property '0' of undefined" in tests

### Pitfall 4: Not Testing Every Error Code
**What goes wrong:** Some error codes never get exercised, leading to typos in ErrorMessages or dead code
**Why it happens:** Easy to forget edge cases when manually writing 27+ test cases
**How to avoid:** Use a checklist or test coverage report. Verify every ErrorCode key has at least one test that produces it.
**Warning signs:** Coverage report shows unused error codes, typos discovered in production

### Pitfall 5: Ignoring Address Validation Return Type
**What goes wrong:** validateAddress() returns ValidationIssue[] with both errors and warnings, treating all as errors loses checksum warnings
**Why it happens:** Assuming all address issues are errors
**How to avoid:** Check issue.severity and push to correct array: `if (issue.severity === 'error') errors.push(issue); else warnings.push(issue)`
**Warning signs:** All-lowercase addresses treated as invalid when they should be valid with warning

### Pitfall 6: Circular Validation Dependencies
**What goes wrong:** Network validation needs address format, address validation needs network namespace, creates import cycle
**Why it happens:** Natural coupling between network type and address format
**How to avoid:** validateAddress() already handles dispatch via getNetworkNamespace(). Network validation only checks CAIP-2 format and registry, not addresses.
**Warning signs:** TypeScript circular dependency errors, undefined function errors

## Code Examples

Verified patterns from validation library research:

### Validation Rule Module Template
```typescript
// Source: Validation pipeline pattern (Medium articles on TypeScript validation)
import type { NormalizedConfig, ValidationIssue } from '../../types'
import { ErrorCode, ErrorMessages } from '../../types/errors'

/**
 * Validate x402Version field
 * Level 2 validation
 */
export function validateVersion(
  config: NormalizedConfig,
  detectedFormat: 'v2' | 'v1' | 'flat-legacy'
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (config.x402Version !== 1 && config.x402Version !== 2) {
    issues.push({
      code: ErrorCode.INVALID_VERSION,
      field: 'x402Version',
      message: ErrorMessages.INVALID_VERSION,
      severity: 'error',
    })
  }

  // Note: Normalized configs always have x402Version (set by normalize())
  // but we include MISSING_VERSION for completeness if normalize() fails

  return issues
}
```

### Amount Validation (Numeric String, Non-Zero)
```typescript
// Source: Validation pattern for numeric strings
import type { AcceptsEntry, ValidationIssue } from '../../types'
import { ErrorCode, ErrorMessages } from '../../types/errors'

export function validateAmount(entry: AcceptsEntry, fieldPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!entry.amount) {
    // Missing amount handled by validateFields, skip here
    return issues
  }

  // Must be numeric string (no decimals, no scientific notation)
  if (!/^\d+$/.test(entry.amount)) {
    issues.push({
      code: ErrorCode.INVALID_AMOUNT,
      field: `${fieldPath}.amount`,
      message: ErrorMessages.INVALID_AMOUNT,
      severity: 'error',
    })
    return issues // Don't check zero if format invalid
  }

  // Must be positive (non-zero)
  if (entry.amount === '0' || BigInt(entry.amount) === 0n) {
    issues.push({
      code: ErrorCode.ZERO_AMOUNT,
      field: `${fieldPath}.amount`,
      message: ErrorMessages.ZERO_AMOUNT,
      severity: 'error',
    })
  }

  return issues
}
```

### Network Validation with Fix Suggestions
```typescript
// Source: Error reporting best practices from validation libraries
import type { AcceptsEntry, ValidationIssue } from '../../types'
import { ErrorCode, ErrorMessages } from '../../types/errors'
import { isValidCaip2, isKnownNetwork, getCanonicalNetwork } from '../../registries'

export function validateNetwork(entry: AcceptsEntry, fieldPath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!entry.network) {
    // Missing network handled by validateFields
    return issues
  }

  // Check CAIP-2 format
  if (!isValidCaip2(entry.network)) {
    const fix = getCanonicalNetwork(entry.network)
    issues.push({
      code: ErrorCode.INVALID_NETWORK_FORMAT,
      field: `${fieldPath}.network`,
      message: ErrorMessages.INVALID_NETWORK_FORMAT,
      severity: 'error',
      fix: fix ? `Use '${fix}' instead of '${entry.network}'` : undefined,
    })
    return issues
  }

  // Check known registry (warning, not error)
  if (!isKnownNetwork(entry.network)) {
    issues.push({
      code: ErrorCode.UNKNOWN_NETWORK,
      field: `${fieldPath}.network`,
      message: ErrorMessages.UNKNOWN_NETWORK,
      severity: 'warning',
    })
  }

  return issues
}
```

### Integration Test with Round-Trip Validation
```typescript
// Source: Round-trip testing pattern
import { describe, test, expect } from 'vitest'
import { validate, normalize } from '../src/index'

describe('round-trip validation', () => {
  test('normalized config validates without errors', () => {
    const flatConfig = {
      payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      amount: '1000000',
      network: 'base',
      asset: 'USDC',
    }

    // First pass: normalize flat config
    const normalized = normalize(flatConfig)
    expect(normalized).not.toBeNull()

    // Second pass: validate normalized output
    const result = validate(normalized!)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)

    // Normalized v2 config should not have legacy warnings
    expect(result.warnings.every(w => w.code !== 'LEGACY_FORMAT')).toBe(true)
  })
})
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Fail-fast validation (stop at first error) | Error accumulation (collect all errors) | 2020-2021 with Zod/Yup popularity | Better UX - users see all problems at once, fix in one pass |
| String literal error codes | Typed const objects with satisfies | TypeScript 4.9+ (2022) | Type safety - compiler catches typos in error codes |
| Throwing exceptions for invalid input | Returning Result/Either types | 2023-2024 functional programming trend | Explicit error handling, no try/catch needed |
| Manual validation logic | Schema-based validation (Zod, Yup) | 2021-2024 | Schema-first types inferred from runtime validators |
| Jest for testing | Vitest for ESM projects | 2022-2026 | 10-20× faster test runs, native ESM support |
| Chai assertions | Vitest native assertions | 2024-2026 | Zero-dependency testing, better TypeScript support |

**Deprecated/outdated:**
- **class-validator decorators:** Popular in NestJS but requires reflect-metadata (heavy), doesn't work well with tree-shaking
- **Joi:** Powerful but large bundle size (~30KB), not TypeScript-first
- **validator.js:** String validators only, no object/nested validation, no TypeScript types

## Open Questions

Things that couldn't be fully resolved:

1. **Should maxTimeoutSeconds validation check realistic bounds?**
   - What we know: Field is optional, should be positive integer if present
   - What's unclear: Should there be upper/lower bounds? (e.g., min 5 seconds, max 86400 seconds)
   - Recommendation: Only check `> 0` for now. Add bounds in future phase if spec defines them.

2. **How to handle unknown fields in accepts entries?**
   - What we know: normalize() preserves them in `extra` field, spec doesn't forbid them
   - What's unclear: Should validation warn about unrecognized fields?
   - Recommendation: Silently preserve in `extra`, don't warn. Extensions are explicitly supported.

3. **Should strict mode affect address checksum warnings?**
   - What we know: All-lowercase addresses produce NO_EVM_CHECKSUM warning (Phase 7 decision)
   - What's unclear: Should strict mode block all-lowercase addresses?
   - Recommendation: Yes. Strict mode promotes ALL warnings to errors, including checksum warnings. This enforces best practices.

4. **Test fixture licensing for real-world configs?**
   - What we know: Can capture token-data-aggregator.json for testing
   - What's unclear: Does including external API responses in test fixtures require attribution/permission?
   - Recommendation: Include as test fixture with comment noting source. API responses are facts, not copyrightable. If concerned, anonymize addresses/amounts.

## Sources

### Primary (HIGH confidence)
- TypeScript 5.9 tsconfig reference (strict mode, exactOptionalPropertyTypes)
- Vitest 4.0 documentation (test organization, coverage, describe blocks)
- Existing codebase (phases 6-7 provide all primitives for orchestration)

### Secondary (MEDIUM confidence)
- [Comparing schema validation libraries: Zod vs. Yup](https://blog.logrocket.com/comparing-schema-validation-libraries-zod-vs-yup/) - Validation patterns in modern TypeScript libraries
- [Data Validation in Typescript Using the Either Pattern](https://dev.to/polyov_dev/data-validation-in-typescript-using-the-either-pattern-4omk) - Result pattern for error handling
- [Leverage the TypeScript Validator Pattern for Robust Data Validation](https://www.webdevtutor.net/blog/typescript-validator-pattern) - Error accumulation pattern
- [Understanding Validation Levels](https://medium.com/@dykyi.roman/understanding-validation-levels-74d0adecda5e) - Multi-level validation architecture
- [Built-In, Nested, Custom Validators with FluentValidation](https://code-maze.com/deep-dive-validators-fluentvalidation/) - Cascading validators and composition
- [Test file organization strategies - Mastering Vitest](https://app.studyraid.com/en/read/11292/352301/test-file-organization-strategies) - Organizing test files and describe blocks
- [Coverage | Guide | Vitest](https://vitest.dev/guide/coverage) - Test coverage configuration and thresholds
- [Round trip test at XUnitPatterns.com](http://xunitpatterns.com/round%20trip%20test.html) - Round-trip testing pattern definition

### Tertiary (LOW confidence)
- [The Pipeline Pattern: Streamlining Data Processing](https://dev.to/wallacefreitas/the-pipeline-pattern-streamlining-data-processing-in-software-architecture-44hn) - Pipeline pattern overview
- [12 Critical Software Testing Trends for 2026](https://aqua-cloud.io/top-12-software-testing-trends/) - Testing industry trends
- [Vitest vs Jest 30: Why 2026 is the Year of Browser-Native Testing](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb) - Framework comparison

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Vitest and TypeScript already in use, zero new dependencies needed
- Architecture: HIGH - Pipeline pattern with error accumulation is well-established, examples from multiple validation libraries
- Pitfalls: HIGH - Based on actual patterns from existing codebase (address validation return type, normalized config guards)
- Code examples: HIGH - Adapted from existing Phase 6-7 code and validation library patterns

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days) - Validation patterns are stable, but Vitest updates frequently
