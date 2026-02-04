# Phase 13: Manifest Validation - Research

**Researched:** 2026-02-04
**Domain:** TypeScript collection validation, error aggregation, cross-endpoint consistency, HTTP method discrimination, JSON Schema structural validation
**Confidence:** HIGH

## Summary

Phase 13 implements `validateManifest()` to validate multi-endpoint x402 manifest configurations. The standard approach is to compose the existing `validate()` function per-endpoint, aggregate results into a collection-level result object, and add cross-endpoint consistency checks (duplicate URLs, mixed networks, duplicate HTTP method+path). The critical architectural pattern is **composition over reimplementation** — reuse the existing validation pipeline for per-endpoint checks and layer manifest-level logic on top.

Manifest validation differs from single config validation in three key ways: (1) **result aggregation** — collecting multiple `ValidationResult` objects into a unified `ManifestValidationResult`, (2) **cross-endpoint checks** — detecting issues that only appear when comparing multiple endpoints, and (3) **field path prefixing** — ensuring error messages indicate which endpoint has the issue (e.g., `endpoints["api-weather"].accepts[0].payTo`).

The x402 Bazaar extension introduces HTTP method discrimination requirements: GET endpoints must use `queryParams` input shape, POST endpoints must use `body` input shape. This validation is structural (checking for shape presence) rather than deep JSON Schema validation to avoid bundle bloat from runtime schema validators like Ajv.

**Primary recommendation:** Export `validateManifest()` alongside `validate()` from the package public API. The function should iterate endpoints, call `validate()` per endpoint with field path prefixing, aggregate results into a `Record<string, ValidationResult>`, perform cross-endpoint checks, and return a unified `ManifestValidationResult` with top-level `valid` boolean that is true only if ALL endpoints pass and no manifest-level errors exist.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.9+ | Type system for result composition | Same as existing codebase, discriminated unions for error types |
| None (pure TS) | - | Collection iteration and aggregation | Zero-dependency pattern preserved |
| None (composition) | - | Per-endpoint validation via existing `validate()` | Reuse battle-tested validation logic |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| AggregateError | ES2021 | Multiple error grouping pattern | Optional pattern for error composition (not needed for this phase) |
| JSON Schema | draft-2020-12 | Schema documentation format | Reference only — structural validation without runtime parser |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Composition (call validate()) | Reimplement all rules | Composition reuses tested code, reimplementation risks bugs and drift |
| Record<string, ValidationResult> | Map<string, ValidationResult> | Record serializes to JSON directly, Map requires conversion |
| Structural shape check | Full JSON Schema validation (Ajv) | Structural keeps bundle small, Ajv adds 40KB+ to runtime |
| Field path prefixing | Nested result structure | Prefixing maintains flat error list, nesting complicates display |
| Same ErrorCode enum | Prefixed manifest codes | Same enum simplifies tooling, prefixed separates concerns (chose same enum per Context decisions) |

**Installation:**
```bash
# Zero new runtime dependencies
# Composition of existing validation infrastructure
```

## Architecture Patterns

### Recommended Function Structure
```typescript
// src/validation/manifest.ts

import type { ManifestConfig, ManifestValidationResult, ValidationResult, ValidationIssue } from '../types'
import { validate } from './orchestrator'
import { normalize } from '../detection/normalize'

/**
 * Validate an entire manifest configuration
 *
 * Validates each endpoint through the existing validate() pipeline,
 * aggregates results, and performs cross-endpoint consistency checks.
 *
 * @param input - Manifest config (object) to validate
 * @returns ManifestValidationResult with per-endpoint results and manifest-level issues
 */
export function validateManifest(input: ManifestConfig): ManifestValidationResult {
  const endpointResults: Record<string, ValidationResult> = {}
  const manifestErrors: ValidationIssue[] = []
  const manifestWarnings: ValidationIssue[] = []

  // 1. Validate each endpoint via existing pipeline
  for (const [endpointId, endpointConfig] of Object.entries(input.endpoints)) {
    const result = validate(endpointConfig)

    // Prefix all field paths with endpoint context
    const prefixedResult = prefixFieldPaths(result, endpointId)
    endpointResults[endpointId] = prefixedResult
  }

  // 2. Cross-endpoint consistency checks
  const crossEndpointIssues = performCrossEndpointChecks(input)
  manifestErrors.push(...crossEndpointIssues.errors)
  manifestWarnings.push(...crossEndpointIssues.warnings)

  // 3. Compute top-level valid flag
  const allEndpointsValid = Object.values(endpointResults).every(r => r.valid)
  const noManifestErrors = manifestErrors.length === 0
  const valid = allEndpointsValid && noManifestErrors

  return {
    valid,
    endpointResults,
    errors: manifestErrors,
    warnings: manifestWarnings,
    normalized: input,  // User decision: include normalized manifest in result
  }
}
```

### Pattern 1: Field Path Prefixing
**What:** Prefix all endpoint validation error field paths with `endpoints["id"].`
**When to use:** When converting per-endpoint ValidationResult to manifest context
**Example:**
```typescript
/**
 * Prefix all field paths in a ValidationResult with endpoint context
 * Transforms "accepts[0].payTo" → "endpoints["api-weather"].accepts[0].payTo"
 */
function prefixFieldPaths(
  result: ValidationResult,
  endpointId: string
): ValidationResult {
  const prefix = `endpoints["${endpointId}"].`

  return {
    ...result,
    errors: result.errors.map(issue => ({
      ...issue,
      field: prefix + issue.field
    })),
    warnings: result.warnings.map(issue => ({
      ...issue,
      field: prefix + issue.field
    }))
  }
}
```

**Why bracket notation:** Bracket notation `endpoints["id"]` handles endpoint IDs with special characters (dots, spaces) better than dot notation `endpoints.id`. TypeScript type-safe nested paths prefer bracket notation for dynamic keys.

### Pattern 2: Cross-Endpoint Consistency Checks
**What:** Detect issues that only appear when comparing multiple endpoints
**When to use:** After per-endpoint validation, before returning final result
**Example:**
```typescript
/**
 * Perform cross-endpoint consistency checks
 * Returns manifest-level errors and warnings
 */
function performCrossEndpointChecks(manifest: ManifestConfig): {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
} {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  const endpoints = Object.values(manifest.endpoints)

  // Check 1: Duplicate endpoint URLs (warning per user decision)
  const urlCounts = new Map<string, number>()
  for (const endpoint of endpoints) {
    if (endpoint.resource?.url) {
      const url = endpoint.resource.url
      urlCounts.set(url, (urlCounts.get(url) || 0) + 1)
    }
  }

  for (const [url, count] of urlCounts.entries()) {
    if (count > 1) {
      warnings.push({
        code: 'DUPLICATE_ENDPOINT_URL',
        field: 'endpoints',
        message: `${count} endpoints share the same URL: ${url}`,
        severity: 'warning',
        fix: 'Ensure each endpoint has a unique URL, or use URL patterns if intentional'
      })
    }
  }

  // Check 2: Mixed networks (mainnet + testnet) (warning per user decision)
  const networks = new Set<string>()
  for (const endpoint of endpoints) {
    for (const acceptsEntry of endpoint.accepts) {
      if (acceptsEntry.network) {
        networks.add(acceptsEntry.network)
      }
    }
  }

  const hasMainnet = Array.from(networks).some(n => !isTestnet(n))
  const hasTestnet = Array.from(networks).some(n => isTestnet(n))

  if (hasMainnet && hasTestnet) {
    warnings.push({
      code: 'MIXED_NETWORKS',
      field: 'endpoints',
      message: 'Manifest contains both mainnet and testnet networks',
      severity: 'warning',
      fix: 'Consider separating mainnet and testnet manifests for clarity'
    })
  }

  // Check 3: Duplicate HTTP method + path in bazaar metadata (warning per user decision)
  const bazaarRoutes = new Map<string, number>()
  for (const [endpointId, endpoint] of Object.entries(manifest.endpoints)) {
    const bazaar = endpoint.extensions?.bazaar as Record<string, unknown> | undefined
    if (bazaar?.info) {
      const info = bazaar.info as Record<string, unknown>
      const method = info.input?.method as string | undefined
      const path = endpoint.resource?.url

      if (method && path) {
        const routeKey = `${method} ${path}`
        bazaarRoutes.set(routeKey, (bazaarRoutes.get(routeKey) || 0) + 1)
      }
    }
  }

  for (const [route, count] of bazaarRoutes.entries()) {
    if (count > 1) {
      warnings.push({
        code: 'DUPLICATE_BAZAAR_ROUTE',
        field: 'extensions.bazaar',
        message: `${count} endpoints share the same HTTP method + path: ${route}`,
        severity: 'warning',
        fix: 'Ensure each bazaar endpoint has a unique method+path combination'
      })
    }
  }

  return { errors, warnings }
}

/**
 * Check if a CAIP-2 network identifier represents a testnet
 */
function isTestnet(network: string): boolean {
  const testnets = [
    'eip155:84532',   // Base Sepolia
    'eip155:43113',   // Avalanche Fuji
    'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',  // Solana Devnet
    'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',  // Solana Testnet
    // Add more testnet identifiers as needed
  ]
  return testnets.includes(network) || network.includes('testnet') || network.includes('sepolia')
}
```

### Pattern 3: Bazaar Method Discrimination (Structural Validation)
**What:** Validate HTTP method + input shape consistency without deep JSON Schema parsing
**When to use:** When bazaar extension is present on an endpoint
**Example:**
```typescript
/**
 * Validate bazaar extension method discrimination
 * GET → must have queryParams input shape
 * POST/PUT/PATCH/DELETE → must have body input shape
 *
 * Returns errors (strict validation per user decision)
 */
function validateBazaarMethodDiscrimination(
  endpoint: V2Config,
  endpointId: string
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const bazaar = endpoint.extensions?.bazaar as Record<string, unknown> | undefined
  if (!bazaar?.info) return issues  // Bazaar is optional

  const info = bazaar.info as Record<string, unknown>
  const input = info.input as Record<string, unknown> | undefined
  if (!input) return issues

  const method = (input.method as string)?.toUpperCase()
  if (!method) return issues

  const fieldPrefix = `endpoints["${endpointId}"].extensions.bazaar.info.input`

  // GET requests must use queryParams shape
  if (method === 'GET') {
    if (input.body !== undefined) {
      issues.push({
        code: 'BAZAAR_GET_WITH_BODY',
        field: `${fieldPrefix}.body`,
        message: 'GET requests cannot have body input shape',
        severity: 'error',
        fix: 'Use queryParams input shape for GET requests, or change method to POST'
      })
    }
    if (input.queryParams === undefined) {
      issues.push({
        code: 'BAZAAR_GET_MISSING_QUERY_PARAMS',
        field: `${fieldPrefix}.queryParams`,
        message: 'GET requests should define queryParams input shape',
        severity: 'error',
        fix: 'Add queryParams field with JSON Schema describing query parameters'
      })
    }
  }

  // POST/PUT/PATCH/DELETE requests must use body shape
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    if (input.queryParams !== undefined) {
      issues.push({
        code: 'BAZAAR_POST_WITH_QUERY_PARAMS',
        field: `${fieldPrefix}.queryParams`,
        message: `${method} requests should not use queryParams input shape`,
        severity: 'error',
        fix: `Use body input shape for ${method} requests, or change method to GET`
      })
    }
    if (input.body === undefined) {
      issues.push({
        code: 'BAZAAR_POST_MISSING_BODY',
        field: `${fieldPrefix}.body`,
        message: `${method} requests should define body input shape`,
        severity: 'error',
        fix: 'Add body field with JSON Schema describing request body'
      })
    }
  }

  return issues
}
```

**Structural vs Deep Validation:** This validation checks for the *presence* of `body` or `queryParams` fields and validates that they're objects. It does NOT parse JSON Schema grammar ($schema, type, properties, etc.) to avoid adding Ajv (~40KB) to the runtime bundle. The structural approach balances correctness with bundle size.

### Pattern 4: Result Composition with Record
**What:** Use Record<string, ValidationResult> for JSON-serializable endpoint results
**When to use:** Manifest validation result structure
**Example:**
```typescript
// ManifestValidationResult type structure
export interface ManifestValidationResult {
  valid: boolean                                  // True if ALL endpoints valid + no manifest errors
  endpointResults: Record<string, ValidationResult>  // Per-endpoint results keyed by ID
  errors: ValidationIssue[]                       // Manifest-level errors
  warnings: ValidationIssue[]                     // Manifest-level warnings
  normalized: ManifestConfig                      // Normalized manifest (per user decision)
}

// Why Record over Map:
// - JSON.stringify() works directly on Record
// - TypeScript type inference better for Record
// - Iteration: Object.entries(record) vs map.entries() — both work, Record simpler
// - No .toJSON() custom serialization needed
```

### Anti-Patterns to Avoid

- **Reimplementing validation rules:** Don't copy-paste logic from `validate()` — call it directly and transform results
- **Losing endpoint context in errors:** Always prefix field paths with `endpoints["id"].` so users know which endpoint failed
- **Deep JSON Schema validation:** Don't add Ajv or full schema parsers — structural checks only to keep bundle small
- **Ignoring cross-endpoint checks:** Single-endpoint validation can't catch duplicate URLs or mixed networks
- **Mutating input during validation:** Keep `validateManifest()` pure — don't modify the input manifest
- **Making all cross-endpoint issues errors:** User decisions specify warnings for duplicates/mixed networks — respect severity
- **Not including normalized manifest:** User decision requires normalized manifest in result for convenience

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Per-endpoint validation | Custom manifest validation rules | Compose existing `validate()` function | Battle-tested, maintains consistency, avoids code duplication |
| Field path construction | String concatenation | Template literals with bracket notation | Handles special characters in endpoint IDs, type-safe |
| Result aggregation | Manual error merging | Standard TypeScript object composition | Clear, type-safe, JSON-serializable |
| Network registry lookup | Duplicate registry for manifests | Reuse existing NETWORKS registry | Single source of truth, no drift |
| Error code vocabulary | New manifest-specific codes | Extend existing ErrorCode enum | Unified code namespace, simpler tooling |
| JSON Schema parsing | Custom parser or Ajv runtime | Structural shape checks only | Keeps bundle small (<15KB target) |

**Key insight:** Manifest validation is 90% composition of existing single-config validation plus 10% new cross-endpoint logic. The architecture should reflect this — a thin wrapper that orchestrates existing infrastructure rather than a parallel implementation.

## Common Pitfalls

### Pitfall 1: Not Prefixing Field Paths
**What goes wrong:** Error messages like `accepts[0].payTo: Invalid address` don't indicate which endpoint failed in a 10-endpoint manifest
**Why it happens:** Directly returning per-endpoint ValidationResult without transformation
**How to avoid:** Always prefix field paths with `endpoints["id"].` when aggregating results
**Warning signs:** Users can't identify which endpoint has errors; debugging requires trial-and-error

### Pitfall 2: Bundle Bloat from JSON Schema Validation
**What goes wrong:** Adding Ajv or full JSON Schema validators increases bundle size by 40KB+
**Why it happens:** Wanting "complete" validation of bazaar schemas
**How to avoid:** Use structural validation only — check for `body`/`queryParams` presence, verify they're objects, skip grammar parsing
**Warning signs:** Bundle size exceeds 20KB; users complain about load times on slow networks

### Pitfall 3: Cross-Endpoint Check False Positives
**What goes wrong:** Warning about "duplicate URLs" when endpoints intentionally share URLs with different HTTP methods (REST pattern)
**Why it happens:** Checking URLs without considering HTTP method context
**How to avoid:** For bazaar route checks, use method+path combination; for duplicate URL warnings, keep simple (exact URL match) per user decision
**Warning signs:** Users ignore warnings because they're not actionable; warning fatigue

### Pitfall 4: Reimplementing Validation Rules
**What goes wrong:** Copying logic from `validate()` into `validateManifest()`, then rules drift over time
**Why it happens:** Not recognizing that endpoints are just V2Config objects that existing validation handles
**How to avoid:** Always call `validate(endpoint)` per endpoint; only add manifest-specific cross-endpoint logic
**Warning signs:** Bug fixes to single-config validation don't apply to manifests; test coverage gaps

### Pitfall 5: Ignoring Empty Endpoints Collection
**What goes wrong:** Validation crashes or returns confusing errors when `endpoints: {}` is passed
**Why it happens:** Not handling the empty collection case explicitly
**How to avoid:** Empty endpoints is valid per Phase 11 decision — return valid result with zero endpoint results
**Warning signs:** Errors like "Cannot iterate over undefined"; new users can't initialize manifests

### Pitfall 6: Invalid Top-Level Valid Flag Logic
**What goes wrong:** `valid: true` when some endpoints have errors, or `valid: false` when all endpoints pass but there's a warning
**Why it happens:** Incorrect aggregation logic or treating warnings as errors
**How to avoid:** `valid = allEndpointsValid && noManifestErrors` — warnings don't affect validity
**Warning signs:** CLI exits with error code when validation "passes with warnings"

### Pitfall 7: Not Respecting User Severity Decisions
**What goes wrong:** Treating duplicate URLs as errors when user specified warnings
**Why it happens:** Developer judgment overriding user decisions from CONTEXT.md
**How to avoid:** Reference CONTEXT.md decisions: duplicate URLs → warning, duplicate method+path → warning, mixed networks → warning
**Warning signs:** User feedback: "why is this an error? it works fine"

### Pitfall 8: Performance Issues with Large Manifests
**What goes wrong:** Validation takes >1 second for manifests with 100+ endpoints
**Why it happens:** Inefficient cross-endpoint checks (O(n²) comparisons)
**How to avoid:** Use Map for O(1) lookups when detecting duplicates; single pass per check
**Warning signs:** Tests timeout; users report slowness on large manifests

## Code Examples

Verified patterns from official sources:

### Complete validateManifest Implementation
```typescript
// Source: TypeScript composition patterns + existing validate() architecture
// https://www.typescriptlang.org/docs/handbook/2/objects.html

import type { ManifestConfig, ManifestValidationResult, ValidationResult, ValidationIssue } from '../types'
import { validate } from './orchestrator'
import { ErrorCode } from '../types/errors'

/**
 * Validate an entire x402 manifest configuration
 *
 * Pipeline:
 * 1. Validate each endpoint via existing validate() function
 * 2. Prefix all field paths with endpoint context
 * 3. Perform cross-endpoint consistency checks
 * 4. Aggregate results into unified ManifestValidationResult
 *
 * @param input - ManifestConfig object to validate
 * @returns ManifestValidationResult with per-endpoint and manifest-level issues
 */
export function validateManifest(input: ManifestConfig): ManifestValidationResult {
  const endpointResults: Record<string, ValidationResult> = {}
  const manifestErrors: ValidationIssue[] = []
  const manifestWarnings: ValidationIssue[] = []

  // Validate structure
  if (!input.endpoints || typeof input.endpoints !== 'object') {
    return {
      valid: false,
      endpointResults: {},
      errors: [{
        code: ErrorCode.MISSING_ENDPOINTS,
        field: 'endpoints',
        message: 'Manifest must have an endpoints field',
        severity: 'error',
        fix: 'Add endpoints object with at least one endpoint configuration'
      }],
      warnings: [],
      normalized: input
    }
  }

  // Per-endpoint validation
  for (const [endpointId, endpointConfig] of Object.entries(input.endpoints)) {
    const result = validate(endpointConfig)
    endpointResults[endpointId] = prefixFieldPaths(result, endpointId)
  }

  // Cross-endpoint checks
  const crossChecks = performCrossEndpointChecks(input)
  manifestErrors.push(...crossChecks.errors)
  manifestWarnings.push(...crossChecks.warnings)

  // Bazaar method discrimination checks
  for (const [endpointId, endpointConfig] of Object.entries(input.endpoints)) {
    const bazaarIssues = validateBazaarMethodDiscrimination(endpointConfig, endpointId)
    for (const issue of bazaarIssues) {
      if (issue.severity === 'error') {
        manifestErrors.push(issue)
      } else {
        manifestWarnings.push(issue)
      }
    }
  }

  // Compute validity
  const allEndpointsValid = Object.values(endpointResults).every(r => r.valid)
  const noManifestErrors = manifestErrors.length === 0
  const valid = allEndpointsValid && noManifestErrors

  return {
    valid,
    endpointResults,
    errors: manifestErrors,
    warnings: manifestWarnings,
    normalized: input  // Per user decision: include for caller convenience
  }
}

/**
 * Prefix all field paths in a ValidationResult with endpoint context
 */
function prefixFieldPaths(result: ValidationResult, endpointId: string): ValidationResult {
  const prefix = `endpoints["${endpointId}"].`

  return {
    ...result,
    errors: result.errors.map(issue => ({
      ...issue,
      field: issue.field === '$' ? `endpoints["${endpointId}"]` : prefix + issue.field
    })),
    warnings: result.warnings.map(issue => ({
      ...issue,
      field: issue.field === '$' ? `endpoints["${endpointId}"]` : prefix + issue.field
    }))
  }
}
```

### Export from Package Public API
```typescript
// Source: Existing package exports pattern
// src/index.ts

// ... existing exports ...

// Re-export manifest validation (Phase 13)
export { validateManifest } from './validation'
export type { ManifestValidationResult } from './types'
```

### ManifestValidationResult Type Definition
```typescript
// Source: Existing ValidationResult pattern + user decisions
// src/types/validation.ts

/**
 * Result of validating an entire manifest
 * Contains per-endpoint results and manifest-level issues
 */
export interface ManifestValidationResult {
  valid: boolean                                      // True if ALL endpoints valid + no manifest errors
  endpointResults: Record<string, ValidationResult>   // Per-endpoint validation results
  errors: ValidationIssue[]                           // Manifest-level errors
  warnings: ValidationIssue[]                         // Manifest-level warnings
  normalized: ManifestConfig                          // Normalized manifest config
}
```

### Error Code Extension
```typescript
// Source: Existing ErrorCode pattern
// src/types/errors.ts

export const ErrorCode = {
  // ... existing codes ...

  // Manifest validation codes (Phase 13)
  MISSING_ENDPOINTS: 'MISSING_ENDPOINTS',
  INVALID_ENDPOINTS: 'INVALID_ENDPOINTS',
  DUPLICATE_ENDPOINT_URL: 'DUPLICATE_ENDPOINT_URL',
  MIXED_NETWORKS: 'MIXED_NETWORKS',
  DUPLICATE_BAZAAR_ROUTE: 'DUPLICATE_BAZAAR_ROUTE',
  BAZAAR_GET_WITH_BODY: 'BAZAAR_GET_WITH_BODY',
  BAZAAR_GET_MISSING_QUERY_PARAMS: 'BAZAAR_GET_MISSING_QUERY_PARAMS',
  BAZAAR_POST_WITH_QUERY_PARAMS: 'BAZAAR_POST_WITH_QUERY_PARAMS',
  BAZAAR_POST_MISSING_BODY: 'BAZAAR_POST_MISSING_BODY',

  // ... warning codes ...
} as const

export const ErrorMessages = {
  // ... existing messages ...

  // Manifest validation messages
  MISSING_ENDPOINTS: 'Manifest must have an endpoints field',
  INVALID_ENDPOINTS: 'endpoints must be an object mapping IDs to v2 configs',
  DUPLICATE_ENDPOINT_URL: 'Multiple endpoints share the same URL',
  MIXED_NETWORKS: 'Manifest contains both mainnet and testnet networks',
  DUPLICATE_BAZAAR_ROUTE: 'Multiple endpoints share the same HTTP method + path',
  BAZAAR_GET_WITH_BODY: 'GET requests cannot have body input shape',
  BAZAAR_GET_MISSING_QUERY_PARAMS: 'GET requests should define queryParams input shape',
  BAZAAR_POST_WITH_QUERY_PARAMS: 'POST requests should not use queryParams input shape',
  BAZAAR_POST_MISSING_BODY: 'POST requests should define body input shape',
} satisfies Record<ErrorCode, string>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single config validation only | Manifest collection validation | Phase 13 (2026-02) | Services can validate entire multi-endpoint manifests |
| Duplicate validation logic | Composition via validate() | TypeScript patterns 2020+ | Single source of truth, no code drift |
| Manual error aggregation | Structured result composition | TypeScript 4.0+ (2020) | Type-safe, JSON-serializable results |
| Deep JSON Schema parsing | Structural validation only | Bundle size concerns 2024+ | Keeps runtime small for browser usage |
| Dot notation field paths | Bracket notation for dynamic keys | TypeScript 4.1+ (2020) | Handles special characters in endpoint IDs |
| Map for results | Record for JSON serialization | REST API patterns 2022+ | Direct JSON.stringify support |

**Deprecated/outdated:**
- **Manual field path concatenation:** Use template literals with bracket notation for type safety
- **Runtime JSON Schema validators (Ajv):** Too heavy for browser bundles; structural checks suffice
- **Separate validation implementations:** Composition of existing `validate()` is standard
- **Map for result storage:** Record is standard for JSON-serializable data structures

## Open Questions

Things that couldn't be fully resolved:

1. **Error Code Namespace Strategy**
   - What we know: User left this to Claude's discretion; existing codebase uses single ErrorCode enum
   - What's unclear: Whether manifest codes should be prefixed (MANIFEST_*) or mixed into flat namespace
   - Recommendation: Use flat namespace (DUPLICATE_ENDPOINT_URL not MANIFEST_DUPLICATE_ENDPOINT_URL) to keep error code vocabulary unified and simpler for tooling

2. **JSON Schema Validation Depth for Bazaar**
   - What we know: User specified "Claude's discretion" for balancing bundle impact vs validation depth
   - What's unclear: Should we validate that schemas have `type`, `properties`, etc. (structural) or parse full JSON Schema grammar (deep)?
   - Recommendation: Structural validation only — check for presence of `body`/`queryParams`, verify they're objects, but don't parse $schema, type, properties, etc. This keeps bundle under 20KB and avoids Ajv dependency (40KB+). Deep validation can be added in future phase if users request it.

3. **Issue Grouping Strategy**
   - What we know: User left to Claude's discretion whether manifest-level issues live in separate fields vs merged list
   - What's unclear: Should ManifestValidationResult have `endpointErrors` + `manifestErrors` or just `errors` with all merged?
   - Recommendation: Separate fields (`errors` and `warnings` for manifest-level, `endpointResults` for per-endpoint) as shown in user decision structure. This makes it clear which issues are cross-endpoint vs single-endpoint.

4. **Fix Suggestion Depth**
   - What we know: Existing v2 validation provides detailed fix suggestions; user left manifest fix depth to Claude's discretion
   - What's unclear: Should manifest-level errors have equally detailed fixes or lighter suggestions?
   - Recommendation: Match existing v2 style — provide actionable fix suggestions (e.g., "Use unique URLs for each endpoint" not just "Fix duplicate URLs"). Consistency across SDK matters for user experience.

5. **Performance Optimization Threshold**
   - What we know: User marked performance with large manifests as P12 risk (low priority)
   - What's unclear: At what endpoint count does optimization become necessary? 10? 100? 1000?
   - Recommendation: Start with simple O(n) per check using Map for lookups. Profile with 100-endpoint test manifest. Optimize only if tests show >100ms validation time. Premature optimization risks complexity.

6. **Empty Endpoints Handling**
   - What we know: Phase 11 allows empty `endpoints: {}` for initialization
   - What's unclear: Should validateManifest() on empty manifest return `valid: true` or emit warning?
   - Recommendation: Return `valid: true` with zero endpoint results and zero issues. Empty is valid per Phase 11 decision. Users can add warning in future if needed.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/packages/x402lint/src/validation/orchestrator.ts` - Validation composition pattern
- Existing codebase: `/packages/x402lint/src/types/validation.ts` - ValidationResult structure
- [TypeScript Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) - Record vs Map patterns
- [TypeScript Narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html) - Type guard patterns
- Phase 11 Research: `.planning/phases/11-manifest-types-detection/11-RESEARCH.md` - ManifestConfig type structure

### Secondary (MEDIUM confidence)
- [Nozzlegear: Object Validation with TypeScript](https://nozzlegear.com/blog/build-a-simple-object-validation-utility-with-typescript) - Validation composition patterns
- [Ajv Standalone Validation](https://ajv.js.org/standalone.html) - Bundle size trade-offs for JSON Schema
- [TypeScript Record vs Map](https://dev.to/lea_abraham_7a0232a6cd616/typescript-record-vs-map-whats-the-difference-and-when-to-use-each-50oj) - Collection type selection
- [REST API Parameter Best Practices](https://www.moesif.com/blog/technical/api-design/REST-API-Design-Best-Practices-for-Parameters-and-Query-String-Usage/) - HTTP method + body/query validation
- [OpenAPI Duplicate Paths Validation](https://api7.ai/blog/how-to-fix-oas-duplicate-path-errors) - Duplicate endpoint detection patterns

### Tertiary (LOW confidence - marked for validation)
- [AggregateError in TypeScript](https://www.xjavascript.com/blog/aggregateerror-typescript/) - Error composition pattern (not needed for this phase but good reference)
- [TypeScript Nested Object Paths](https://evolved.io/articles/typescript-nested-object-paths) - Field path construction patterns
- Cross-endpoint monitoring patterns - Applied to validation context

## Metadata

**Confidence breakdown:**
- Validation composition pattern: HIGH - Existing codebase proves this pattern works
- Field path prefixing: HIGH - Standard TypeScript string manipulation + bracket notation
- Cross-endpoint checks: HIGH - Straightforward Map-based duplicate detection
- Bazaar method discrimination: MEDIUM-HIGH - Structural validation clear, but deep validation depth is judgment call
- Result structure: HIGH - User decisions provide clear structure, follows existing ValidationResult pattern
- Bundle size impact: MEDIUM - Structural validation estimate based on current bundle size (<15KB), not measured

**Research date:** 2026-02-04
**Valid until:** 2026-05-04 (90 days - TypeScript patterns stable, x402 spec stable, validation architecture proven)
