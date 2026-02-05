---
phase: 14
plan: 02
subsystem: cli
tags: [cli, manifest, formatting, routing, auto-detection, table-output]
requires: [14-01, 13-01, 13-02, 11-01]
provides: [manifest-cli-output, auto-detection-ui, summary-table, exit-code-logic]
affects: [15-website, 16-final]
tech-stack:
  added: [cli-table3]
  patterns: [post-validation-strict-mode]
key-files:
  created:
    - packages/x402check/src/cli/format.ts
  modified:
    - packages/x402check/src/cli.ts
decisions:
  - id: post-validation-strict
    title: Apply strict mode post-validation for manifests
    rationale: validateManifest() doesn't accept options, so CLI applies strict mode by promoting warnings to errors after validation
    impact: Clean separation between SDK (always returns warnings) and CLI (can promote to errors)
  - id: majority-pass-exit
    title: Manifest exit code based on majority pass/fail
    rationale: Single failing endpoint shouldn't fail entire manifest validation
    impact: Exit 0 if majority pass, 1 if majority fail, tie defaults to 1 (fail-safe)
  - id: detection-announcements
    title: Print detection announcements before results
    rationale: User clarity about what format was detected
    impact: "Detected: manifest with N endpoints" or "Detected: v2 config" shown in terminal mode
  - id: cli-table3-bundling
    title: Bundle cli-table3 with CLI binary
    rationale: CLI binary has external=[] to avoid runtime dependencies
    impact: CLI bundle size 216 KB (up from ~80 KB), but still acceptable for standalone binary
metrics:
  duration: 3.3min
  completed: 2026-02-05
---

# Phase 14 Plan 02: CLI Manifest Mode Summary

**One-liner:** CLI auto-detects and formats manifests with summary table + per-endpoint details, preserves single-config output

## What Was Built

Created the core CLI manifest mode implementation connecting all Phase 14 infrastructure modules.

**Format module (format.ts):**
- `formatManifestResult()` with cli-table3 summary table (status, endpoint, errors, warnings)
- Per-endpoint details sections with full validation results
- Cross-endpoint issues section for manifest-level errors/warnings
- `formatValidationResult()` and `formatCheckResult()` ported from old cli.ts
- `formatIssue()` helper with color support parameter
- `calculateExitCode()` with majority-pass logic and strict mode handling
- Color support detection (TTY check, NO_COLOR env var)
- Three output modes: JSON (pure parseable), quiet (exit code only), terminal (formatted)

**CLI rewrite (cli.ts):**
- Composed all modules: args, fetch, detect, format
- `handleUrl()` for URL fetching with manifest detection
- `handleFileOrJson()` for file/stdin with manifest routing
- `applyStrictMode()` helper to promote warnings to errors post-validation
- Auto-detection announcements: "Detected: manifest with N endpoints"
- Wild manifest normalization warnings displayed before results
- Dash (-) stdin convention support
- Updated help text with manifest examples, --header flag, exit code clarification
- Exit codes: 0 (valid/majority pass), 1 (invalid/majority fail), 2 (input errors)

**Key integration points:**
1. `resolveInput()` detects manifest vs single-config
2. Manifest path → `validateManifest()` → `applyStrictMode()` (if --strict) → `formatManifestResult()` → `calculateExitCode()`
3. Single-config path → `validate()` or `check()` → format → exit
4. URL path → `fetchWithRedirects()` → detect → route to manifest or single-config flow

## Technical Implementation

**Summary table rendering:**
```typescript
const table = new Table({
  head: ['Status', 'Endpoint', 'Errors', 'Warnings'],
  style: { head: useColor ? ['cyan'] : [], border: [] },
  chars: { /* compact style without borders */ }
})
```

**Strict mode application:**
```typescript
function applyStrictMode(result: ManifestValidationResult): ManifestValidationResult {
  // Promote manifest-level warnings to errors
  const manifestErrors = [...result.errors, ...result.warnings.map(w => ({ ...w, severity: 'error' }))]

  // Promote endpoint-level warnings to errors, recompute valid flags
  const newEndpointResults = Object.fromEntries(
    Object.entries(result.endpointResults).map([id, r] => [
      id,
      { ...r, errors: [...r.errors, ...r.warnings.map(w => ({ ...w, severity: 'error' }))], warnings: [], valid: ... }
    ])
  )

  return { valid: ..., errors: manifestErrors, warnings: [], endpointResults: newEndpointResults, normalized: result.normalized }
}
```

**Exit code calculation:**
```typescript
export function calculateExitCode(result: ManifestValidationResult, strict: boolean): number {
  if (Object.keys(result.endpointResults).length === 0) return 0 // empty is valid
  if (result.errors.length > 0) return 1 // manifest-level errors
  if (strict && result.warnings.length > 0) return 1 // manifest-level warnings in strict

  const passingCount = Object.values(result.endpointResults).filter(r =>
    strict ? (r.valid && r.warnings.length === 0) : r.valid
  ).length
  const failingCount = Object.keys(result.endpointResults).length - passingCount

  return passingCount > failingCount ? 0 : 1 // tie defaults to 1
}
```

## Deviations from Plan

None - plan executed exactly as written.

## Testing Performed

**Manual verification tests:**
1. `pnpm --filter x402check build` - Build succeeded (216.42 KB CLI bundle)
2. `node dist/cli.mjs --help` - Updated help text with manifest examples
3. `node dist/cli.mjs --version` - Prints 0.3.1
4. Manifest input → Summary table + endpoint details displayed correctly
5. Single-config input → Existing output preserved (no regression)
6. `--json` with manifest → Pure parseable JSON output
7. `--quiet` with manifest → No output, exit code only
8. `--strict` with config → Warnings promoted to errors
9. Nonexistent file → Exit code 2 with error message
10. Stdin with dash (-) → Input read correctly from stdin

**Exit code verification:**
- Valid config → 0
- Invalid config → 1
- File not found → 2
- Manifest with majority failing endpoints → 1

**Output format verification:**
- Terminal mode: Color support detected, table rendered, endpoint details shown
- JSON mode: Pure JSON with no ANSI codes
- Quiet mode: Empty output string

## Next Phase Readiness

**Phase 15 (Website Integration) is ready:**
- CLI binary builds successfully
- Manifest validation produces clean output
- JSON mode provides machine-parseable results for website WASM integration
- All flags and modes tested and working

**Phase 16 (Final v3.0 Release) is ready:**
- CLI is feature-complete for manifest mode
- Exit codes are meaningful and documented
- Help text is comprehensive
- No known bugs or regressions

## Key Learnings

1. **Post-validation strict mode pattern works well** - Keeping SDK validation pure (always returns warnings) and CLI promotion (optional strict mode) maintains clean separation of concerns

2. **cli-table3 bundling is acceptable** - 216 KB CLI bundle is larger than ideal but reasonable for standalone binary with no runtime dependencies

3. **Detection announcements improve UX** - Printing "Detected: manifest with N endpoints" before results helps users understand auto-detection behavior

4. **Majority-pass exit code is right heuristic** - Single failing endpoint shouldn't fail entire manifest, but tie defaults to 1 for fail-safe behavior

5. **Shebang must be in banner only** - Having shebang in source file causes duplication in bundle; tsdown banner handles it correctly

## Files Changed

**Created:**
- `packages/x402check/src/cli/format.ts` (320 lines)

**Modified:**
- `packages/x402check/src/cli.ts` (rewritten, 278 lines)

## Commits

- `de75476` - feat(14-02): create CLI format module with manifest table output
- `2ea36a6` - feat(14-02): rewrite CLI with manifest routing and auto-detection
