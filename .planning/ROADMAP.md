# Roadmap: x402check

## Overview

Transform x402 payment configuration validation from manual specification checking to instant feedback. Build client-side validation engine with proxy support, enabling developers to validate configs in under 30 seconds. Progress from core validation logic through input handling to polished display, delivering a simple developer tool with zero framework complexity.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Validation** - Project setup + core validation engine
- [ ] **Phase 2: Input & Proxy** - URL/JSON input modes + CORS proxy
- [ ] **Phase 3: Results Display** - Error messages, success states, formatting
- [ ] **Phase 4: Polish** - Examples, mobile responsiveness, final hardening

## Phase Details

### Phase 1: Foundation & Validation
**Goal**: Validation engine correctly validates x402 configs with chain-specific address checking
**Depends on**: Nothing (first phase)
**Requirements**: VAL-01, VAL-02, VAL-03, VAL-04, VAL-05, VAL-06, VAL-07, VAL-08, VAL-09, VAL-10
**Success Criteria** (what must be TRUE):
  1. Tool validates required fields (x402Version=1, payments array with at least one entry)
  2. Tool validates each payment has chain, address, asset, minAmount fields
  3. Tool validates chain is one of: base, base-sepolia, solana, solana-devnet
  4. Tool validates EVM addresses using checksum (EIP-55 format, 42 chars with 0x)
  5. Tool validates Solana addresses using Base58 format (32-44 chars)
  6. Tool validates chain/asset combinations (USDC/ETH/USDT for EVM, USDC/SOL for Solana)
  7. Tool validates minAmount is positive decimal
  8. Tool validates optional fields when present (facilitator.url is HTTPS, maxAmount >= minAmount)
  9. Tool distinguishes errors (blocking) from warnings (recommendations)
**Plans**: TBD

Plans:
- [ ] TBD (to be planned)

### Phase 2: Input & Proxy
**Goal**: Users can submit configs via URL or direct JSON paste
**Depends on**: Phase 1
**Requirements**: INP-01, INP-02, INP-03, INP-05
**Success Criteria** (what must be TRUE):
  1. User can enter URL in input field and submit for validation
  2. User can paste raw JSON into textarea and submit for validation
  3. User can toggle between URL and JSON input modes via tabs
  4. Tool fetches URLs via Cloudflare Worker proxy (bypasses CORS)
  5. Tool extracts config from X-Payment header or response body (handles both 402 and 200 status)
  6. Tool shows loading state while fetching URL
**Plans**: TBD

Plans:
- [ ] TBD (to be planned)

### Phase 3: Results Display
**Goal**: Users see clear pass/fail status with actionable error messages
**Depends on**: Phase 2
**Requirements**: RES-01, RES-02, RES-03, RES-04, RES-05, INP-04, UX-01
**Success Criteria** (what must be TRUE):
  1. Tool displays clear pass/fail status badge after validation
  2. Tool displays specific error messages identifying field and how to fix it
  3. Tool displays success confirmation with config summary when valid
  4. Tool formats and beautifies JSON output for readability
  5. User can copy validated/formatted config to clipboard with one click
  6. User can load example valid x402 config with one click
  7. Tool shows loading state during URL fetch and validation
**Plans**: TBD

Plans:
- [ ] TBD (to be planned)

### Phase 4: Polish
**Goal**: Tool is production-ready with mobile support and comprehensive edge case coverage
**Depends on**: Phase 3
**Requirements**: UX-02
**Success Criteria** (what must be TRUE):
  1. Tool is responsive and usable on mobile devices (320px width minimum)
  2. Tool handles edge cases gracefully (malformed JSON, network errors, timeout scenarios)
  3. Tool performs acceptably on slow connections (debouncing, perceived performance)
**Plans**: TBD

Plans:
- [ ] TBD (to be planned)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Validation | 0/TBD | Not started | - |
| 2. Input & Proxy | 0/TBD | Not started | - |
| 3. Results Display | 0/TBD | Not started | - |
| 4. Polish | 0/TBD | Not started | - |
