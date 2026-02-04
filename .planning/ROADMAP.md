# Roadmap: x402check

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-01-29) → [archive](milestones/v1.0-ROADMAP.md)
- ✅ **v2.0 Spec-Compliant SDK** — Phases 5-10 (shipped 2026-02-04) → [archive](milestones/v2.0-ROADMAP.md)
- **v3.0 Manifest Validation & CLI** — Phases 11-16

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-01-29</summary>

- [x] Phase 1: Foundation & Validation (2/2 plans) — completed 2026-01-29
- [x] Phase 2: Input & Proxy (2/2 plans) — completed 2026-01-29
- [x] Phase 3: Results Display & UX — completed 2026-01-29
- [x] Phase 4: Examples & Help — completed 2026-01-29

</details>

<details>
<summary>✅ v2.0 Spec-Compliant SDK (Phases 5-10) — SHIPPED 2026-02-04</summary>

- [x] Phase 5: Repository Restructuring (1/1 plan) — completed 2026-01-29
- [x] Phase 6: Types, Detection, Normalization (3/3 plans) — completed 2026-01-29
- [x] Phase 7: Crypto & Address Validation (2/2 plans) — completed 2026-01-29
- [x] Phase 8: Validation Rules & Orchestrator (3/3 plans) — completed 2026-01-29
- [x] Phase 9: Build Pipeline (1/1 plan) — completed 2026-01-29
- [x] Phase 10: Website Integration (2/2 plans) — completed 2026-01-29

</details>

### v3.0 Manifest Validation & CLI (Phases 11-16)

---

#### Phase 11: Manifest Types & Detection

**Goal:** Developers can detect whether input is a manifest (multi-endpoint collection) vs a single x402 config, and non-standard wild manifests are recognized and normalized.

**Dependencies:** None (v2.0 foundation complete)

**Plans:** 2 plans

Plans:
- [x] 11-01-PLAN.md — Manifest types, extended ConfigFormat, guards, and detection order
- [x] 11-02-PLAN.md — Wild manifest normalization and comprehensive tests

**Requirements:**
- MAN-01: Manifest schema definition (collection of v2 PaymentRequired entries with service metadata)
- MAN-04: Compatibility layer for non-standard wild manifests (normalize biwas-style formats)

**Success Criteria:**
1. `detect()` returns `'manifest'` for valid manifest JSON and continues to return `'v2'`, `'v1'`, or `'unknown'` for single configs
2. `ManifestConfig` type defines the canonical manifest shape with service metadata and an endpoints collection of v2 PaymentRequired entries
3. Non-standard manifest formats (biwas-style) are detected, normalized to canonical shape, and produce warnings describing what was transformed
4. `isManifestConfig()` type guard reliably distinguishes manifests from single v2 configs (manifest checked before v2 in detection order)

**Key Risks:** Detection order -- manifest must be checked BEFORE v2 since manifests may also contain `x402Version: 2` (P4 from Pitfalls). Over-normalization corrupting financial data in wild manifests (P7).

---

#### Phase 12: Stacks Chain Support

**Goal:** Developers with Stacks-based x402 endpoints get address validation with the same depth as EVM and Solana chains.

**Dependencies:** None (parallel with Phase 13, extends existing address validation registry)

**Requirements:**
- MAN-05: Stacks chain address validation (SP/SM addresses, c32check encoding)

**Success Criteria:**
1. Stacks mainnet addresses (SP prefix) and contract addresses (SM prefix) pass validation when paired with `stacks:mainnet` network
2. Stacks testnet addresses (ST prefix, SN prefix) pass validation when paired with `stacks:testnet` network
3. Invalid c32check checksums produce an error with actionable fix suggestion
4. Mainnet address on testnet network (and vice versa) produces an error identifying the mismatch

**Key Risks:** c32check version byte confusion across 4 combinations: mainnet P2PKH (SP, v22), mainnet P2SH (SM, v20), testnet P2PKH (ST, v26), testnet P2SH (SN, v21) (P3). API shape assumptions about c32check decoder (P10).

---

#### Phase 13: Manifest Validation

**Goal:** Developers can validate an entire manifest -- per-endpoint correctness via the existing pipeline plus cross-endpoint consistency checks and bazaar method discrimination.

**Dependencies:** Phase 11 (manifest types and detection)

**Requirements:**
- MAN-02: Manifest detection & validation (structure, per-endpoint, cross-endpoint checks)
- MAN-03: Full bazaar extension validation (shape, JSON Schema, method type discrimination)
- MAN-09: `validateManifest()` SDK export with `ManifestValidationResult`

**Success Criteria:**
1. `validateManifest()` returns a `ManifestValidationResult` containing per-endpoint `ValidationResult` entries plus manifest-level errors and warnings
2. Each endpoint in the manifest is validated through the existing `validate()` pipeline, with field paths prefixed by endpoint identifier (e.g., `endpoints["api/data"].accepts[0].payTo`)
3. Cross-endpoint checks detect: duplicate endpoint URLs (warning), inconsistent payTo addresses across endpoints (warning), and duplicate HTTP method+path in bazaar metadata (error)
4. Bazaar extensions are validated for method discrimination -- GET endpoints require queryParams input shape, POST endpoints require body input shape, and mismatches produce errors
5. `validateManifest()` is exported from the package public API alongside `validate()`, `detect()`, and `normalize()`

**Key Risks:** Field paths losing endpoint context in error messages (P4). Bazaar JSON Schema validation bloating the bundle if Ajv leaks into runtime (P6). Performance with large manifests (P12).

---

#### Phase 14: CLI Manifest Mode

**Goal:** Developers can run `npx x402check` against a manifest file or URL and get per-endpoint validation results in the terminal.

**Dependencies:** Phase 13 (manifest validation orchestrator)

**Requirements:**
- MAN-06: CLI (`npx x402check <url-or-file>`) with auto-detection of single config vs manifest

**Success Criteria:**
1. `npx x402check manifest.json` auto-detects the input as a manifest and runs `validateManifest()`, displaying per-endpoint summaries followed by cross-endpoint issues
2. `npx x402check config.json` auto-detects a single config and runs `validate()` with existing output formatting (no regression)
3. `--json` flag outputs pure JSON (parseable by `JSON.parse()`) for both single configs and manifests, with no ANSI codes
4. `--quiet` suppresses output and communicates results via exit code only (0=valid, 1=validation errors, 2=input errors)
5. All flag combinations compose correctly: `--strict --json` outputs strict-mode JSON, `--quiet` takes precedence over `--json`

**Key Risks:** CLI code leaking into library bundle via Node.js imports (P1). Shebang + ESM compatibility across platforms (P2). Flag composition conflicts (P9).

---

#### Phase 15: Website Manifest UI

**Goal:** Developers can paste a manifest JSON or URL into x402check.com and see per-endpoint validation results with the same clarity as single-config validation.

**Dependencies:** Phase 13 (manifest validation orchestrator); parallel with Phase 14

**Requirements:**
- MAN-08: Website manifest validation mode (paste JSON/URL, per-endpoint results)

**Success Criteria:**
1. Pasting a manifest JSON into the input area auto-detects the format and renders per-endpoint validation cards instead of the single-config results view
2. Each endpoint card shows its own pass/fail verdict, errors, and warnings with field paths scoped to that endpoint
3. Cross-endpoint issues (duplicates, inconsistencies) appear in a separate summary section above or below the endpoint cards
4. Switching between manifest and single-config input clears previous results without stale state or rendering artifacts

**Key Risks:** Mode switching leaving stale state or crashing the display (P8).

---

#### Phase 16: Build & Publish

**Goal:** The `x402check` package is published to npm and installable by any developer worldwide.

**Dependencies:** Phases 11-15 complete (all features landed)

**Requirements:**
- MAN-07: npm publish to registry

**Success Criteria:**
1. `npm install x402check` installs successfully and `validate()`, `validateManifest()`, `detect()`, `normalize()` are all importable
2. `npx x402check --version` prints the correct version and `npx x402check --help` prints usage
3. IIFE bundle loads in a browser `<script>` tag and exposes all public APIs on `window.x402check` (or equivalent global)
4. `npm pack` output contains all expected files: ESM, CJS, IIFE, CLI binary, TypeScript declarations
5. Bundle size stays under 45 KB minified (measured, not estimated)

**Key Risks:** First npm publish missing files in the tarball (P5). x402lint alias postpublish hook failing silently (P11).

---

## Dependency Graph

```
Phase 11 (Types & Detection) ──┬──> Phase 13 (Manifest Validation) ──┬──> Phase 14 (CLI)     ──┐
                                │                                     └──> Phase 15 (Website)  ──┤──> Phase 16 (Publish)
Phase 12 (Stacks)  ─────────────┘ (parallel with 13)                                            │
                                                                                                 │
                                   Phase 12 also feeds directly into ─────────────────────────────┘
```

**Critical path:** 11 → 13 → 14 → 16
**Parallel opportunities:** 12 runs parallel with 13; 14 runs parallel with 15

## Requirement Coverage

| Requirement | ID | Phase | Status |
|-------------|-----|-------|--------|
| Manifest schema definition | MAN-01 | Phase 11 | Complete |
| Manifest detection & validation | MAN-02 | Phase 13 | Pending |
| Full bazaar extension validation | MAN-03 | Phase 13 | Pending |
| Wild manifest compatibility | MAN-04 | Phase 11 | Complete |
| Stacks chain address validation | MAN-05 | Phase 12 | Pending |
| CLI with auto-detection | MAN-06 | Phase 14 | Pending |
| npm publish to registry | MAN-07 | Phase 16 | Pending |
| Website manifest validation mode | MAN-08 | Phase 15 | Pending |
| `validateManifest()` SDK export | MAN-09 | Phase 13 | Pending |

**Coverage: 9/9 requirements mapped. No orphans.**

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Validation | v1.0 | 2/2 | Complete | 2026-01-29 |
| 2. Input & Proxy | v1.0 | 2/2 | Complete | 2026-01-29 |
| 3. Results Display & UX | v1.0 | -- | Complete | 2026-01-29 |
| 4. Examples & Help | v1.0 | -- | Complete | 2026-01-29 |
| 5. Repository Restructuring | v2.0 | 1/1 | Complete | 2026-01-29 |
| 6. Types, Detection, Normalization | v2.0 | 3/3 | Complete | 2026-01-29 |
| 7. Crypto & Address Validation | v2.0 | 2/2 | Complete | 2026-01-29 |
| 8. Validation Rules & Orchestrator | v2.0 | 3/3 | Complete | 2026-01-29 |
| 9. Build Pipeline | v2.0 | 1/1 | Complete | 2026-01-29 |
| 10. Website Integration | v2.0 | 2/2 | Complete | 2026-01-29 |
| 11. Manifest Types & Detection | v3.0 | 2/2 | Complete | 2026-02-04 |
| 12. Stacks Chain Support | v3.0 | -- | Pending | -- |
| 13. Manifest Validation | v3.0 | -- | Pending | -- |
| 14. CLI Manifest Mode | v3.0 | -- | Pending | -- |
| 15. Website Manifest UI | v3.0 | -- | Pending | -- |
| 16. Build & Publish | v3.0 | -- | Pending | -- |

---
*Roadmap created: 2026-01-29*
*Last updated: 2026-02-04 -- Phase 11 complete (2/2 plans, verified)*
