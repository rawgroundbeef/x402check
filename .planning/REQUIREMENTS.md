# Requirements: x402check

**Defined:** 2025-01-22
**Core Value:** Developers can validate their x402 config in under 30 seconds with actionable feedback

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Input

- [ ] **INP-01**: User can enter a URL and submit for validation
- [ ] **INP-02**: User can paste raw JSON into a textarea and submit for validation
- [ ] **INP-03**: User can toggle between URL and JSON input modes via tabs
- [ ] **INP-04**: User can load an example valid x402 config with one click
- [ ] **INP-05**: Tool fetches URL via Cloudflare Worker proxy to bypass CORS

### Validation

- [ ] **VAL-01**: Tool validates x402Version field exists and equals 1
- [ ] **VAL-02**: Tool validates payments array exists and has at least one entry
- [ ] **VAL-03**: Tool validates each payment has required fields (chain, address, asset, minAmount)
- [ ] **VAL-04**: Tool validates chain is one of: base, base-sepolia, solana, solana-devnet
- [ ] **VAL-05**: Tool validates EVM addresses using checksum (EIP-55 format, 42 chars starting with 0x)
- [ ] **VAL-06**: Tool validates Solana addresses using Base58 format (32-44 chars)
- [ ] **VAL-07**: Tool validates asset is valid for chain (USDC/ETH/USDT for EVM, USDC/SOL for Solana)
- [ ] **VAL-08**: Tool validates minAmount is a positive decimal number
- [ ] **VAL-09**: Tool validates optional fields when present (facilitator.url is HTTPS, maxAmount >= minAmount)
- [ ] **VAL-10**: Tool distinguishes errors (blocking) from warnings (recommendations)

### Results

- [ ] **RES-01**: Tool displays clear pass/fail status badge after validation
- [ ] **RES-02**: Tool displays specific error messages identifying the field and how to fix it
- [ ] **RES-03**: Tool displays success confirmation with config summary when valid
- [ ] **RES-04**: User can copy validated/formatted config to clipboard with one click
- [ ] **RES-05**: Tool formats and beautifies JSON output for readability

### UX

- [ ] **UX-01**: Tool shows loading state while fetching URL
- [ ] **UX-02**: Tool is responsive and usable on mobile devices

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Display

- **RES-06**: User can toggle between formatted and raw JSON view
- **RES-07**: User can share validation results via URL hash

### Polish

- **UX-03**: Tool supports dark mode
- **UX-04**: Tool supports keyboard shortcuts (Ctrl+Enter to validate)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Test payments | Validation only, no actual transactions |
| Facilitator liveness checks | Just validate URL format, don't ping |
| On-chain balance validation | Don't check if address has funds |
| Batch validation | One config at a time for v1 |
| Custom/unknown chains | Strict validation of known chains only |
| User accounts | Contradicts privacy-first, adds complexity |
| File upload input | URL and paste sufficient for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INP-01 | Phase 2 | Pending |
| INP-02 | Phase 2 | Pending |
| INP-03 | Phase 2 | Pending |
| INP-04 | Phase 3 | Pending |
| INP-05 | Phase 2 | Pending |
| VAL-01 | Phase 1 | Pending |
| VAL-02 | Phase 1 | Pending |
| VAL-03 | Phase 1 | Pending |
| VAL-04 | Phase 1 | Pending |
| VAL-05 | Phase 1 | Pending |
| VAL-06 | Phase 1 | Pending |
| VAL-07 | Phase 1 | Pending |
| VAL-08 | Phase 1 | Pending |
| VAL-09 | Phase 1 | Pending |
| VAL-10 | Phase 1 | Pending |
| RES-01 | Phase 3 | Pending |
| RES-02 | Phase 3 | Pending |
| RES-03 | Phase 3 | Pending |
| RES-04 | Phase 3 | Pending |
| RES-05 | Phase 3 | Pending |
| UX-01 | Phase 3 | Pending |
| UX-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2025-01-22*
*Last updated: 2026-01-22 after roadmap creation*
