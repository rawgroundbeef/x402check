---
phase: 12-stacks-chain-support
plan: 01
status: complete
subsystem: address-validation
tags: [stacks, blockchain, c32check, validation]
requires: [phase-07-address-validation]
provides:
  - stacks-address-validation
  - c32check-integration
  - network-aware-version-validation
affects: [phase-13-manifest-validation]
tech-stack:
  added: [c32check@2.0.0]
  patterns: [crypto-wrapper-pattern, network-aware-validation]
key-files:
  created:
    - packages/x402check/src/crypto/c32check.ts
    - packages/x402check/src/validation/stacks-address.ts
    - packages/x402check/test/validation/stacks-address.test.ts
  modified:
    - packages/x402check/package.json
    - packages/x402check/src/crypto/index.ts
    - packages/x402check/src/types/errors.ts
    - packages/x402check/src/registries/networks.ts
    - packages/x402check/src/registries/simple-names.ts
    - packages/x402check/src/validation/address.ts
    - packages/x402check/test/validation/address.test.ts
    - packages/x402check/test/integration.test.ts
decisions:
  c32check-dependency: "Use standalone c32check package (not @stacks/transactions) for minimal bundle overhead"
  version-byte-validation: "Validate version bytes against network - SP/SM only valid on stacks:1, ST/SN only on stacks:2147483648"
  contract-name-handling: "Strip .contract-name suffix before validation, validate base address only"
  error-granularity: "Single INVALID_STACKS_ADDRESS code for format/checksum errors, separate STACKS_NETWORK_MISMATCH for network mismatches"
  bundle-size-tradeoff: "Accept 58.19 KB bundle (over 45KB target) given 19.86 KB gzipped and comprehensive validation depth"
metrics:
  duration: 4m 19s
  commits: 2
  tests-added: 20+
  lines-of-code: ~400
  bundle-size: 58.19 KB (19.86 KB gzipped)
  test-pass-rate: 361/361 (100%)
completed: 2026-02-04
---

# Phase 12 Plan 01: Stacks Address Validation Summary

**One-liner:** Stacks address validation with SP/SM/ST/SN prefix support, c32check encoding verification, and network-aware version byte validation using c32check library.

## What Was Built

Added complete Stacks blockchain address validation to x402check, matching the depth and quality of existing EVM and Solana chain support:

1. **c32check Integration**
   - Installed c32check@2.0.0 as devDependency for c32 encoding/decoding
   - Created crypto/c32check.ts wrapper following base58.ts pattern
   - Wrapped c32addressDecode to catch and translate errors user-friendly

2. **Network Registry Updates**
   - Added `stacks` to NetworkType union
   - Registered stacks:1 (Stacks Mainnet) and stacks:2147483648 (Stacks Testnet)
   - Added simple name mappings: stacks → stacks:1, stacks-mainnet → stacks:1, stacks-testnet → stacks:2147483648

3. **Error Code Vocabulary**
   - INVALID_STACKS_ADDRESS: Format errors, checksum failures, unrecognized versions
   - STACKS_NETWORK_MISMATCH: Address version doesn't match specified network

4. **Stacks Address Validator**
   - Validates SP (mainnet P2PKH), SM (mainnet P2SH), ST (testnet P2PKH), SN (testnet P2SH)
   - Strips contract name suffix (.my-contract) before validation
   - Decodes address via c32check to verify checksum
   - Validates version byte matches network (22/20 for mainnet, 26/21 for testnet)
   - Returns actionable error messages without technical jargon

5. **Address Dispatcher Integration**
   - Added `case 'stacks'` to address.ts dispatcher
   - Passes network parameter to validateStacksAddress (required for version validation)
   - Cross-chain mismatches naturally caught (Stacks address on EVM fails EVM validation)

6. **Comprehensive Test Coverage**
   - 20+ tests covering valid addresses (all 4 prefixes), invalid format, bad checksums
   - Network mismatch detection in both directions (mainnet on testnet, testnet on mainnet)
   - Contract name suffix handling
   - Cross-chain mismatch tests (Stacks vs EVM)
   - Integration test updated to account for new error codes

## Decisions Made

**c32check dependency strategy**
- Chose standalone c32check package over @stacks/transactions (adds ~13KB vs ~50KB+)
- Tree-shaken into bundle as devDependency (matches @noble/hashes and @scure/base pattern)
- Browser-compatible with zero runtime dependencies

**Version byte validation approach**
- Network-aware validation required - version byte determines mainnet vs testnet
- SP (v22) and SM (v20) only valid on stacks:1
- ST (v26) and SN (v21) only valid on stacks:2147483648
- Return STACKS_NETWORK_MISMATCH with specific direction in message

**Contract name handling**
- Strip .contract-name suffix before validation (e.g., SP123.token → SP123)
- Accept both P2PKH (SP/ST) and P2SH (SM/SN) equally as valid payTo targets
- Don't distinguish between standard and contract addresses in validation output

**Error message philosophy**
- Never mention "c32check", "version byte", or technical encoding details
- Checksum errors: "Invalid Stacks address checksum. Double-check the address for typos."
- Network mismatches: "This is a Stacks mainnet address but the network is set to testnet (stacks:2147483648)"
- Fix suggestions: "Use stacks:1 for mainnet addresses, or use a testnet address (ST/SN prefix)"

**Bundle size tradeoff**
- IIFE bundle: 58.19 KB (over 45KB conservative target)
- Gzipped: 19.86 KB (excellent compression ratio)
- Tradeoff justified: c32check adds ~13KB but provides battle-tested checksum validation (123k weekly downloads, used by all Stacks wallets)
- Alternative would be vendoring critical functions, but custom checksum implementation risks silent failures

## Deviations from Plan

None - plan executed exactly as written.

## Key Files

**New files:**
- `src/crypto/c32check.ts` - c32check decoder wrapper (23 lines)
- `src/validation/stacks-address.ts` - Stacks address validator (114 lines)
- `test/validation/stacks-address.test.ts` - Comprehensive tests (204 lines)

**Modified files:**
- `package.json` - Added c32check@2.0.0 devDependency
- `src/crypto/index.ts` - Export decodeC32Address
- `src/types/errors.ts` - Added INVALID_STACKS_ADDRESS and STACKS_NETWORK_MISMATCH
- `src/registries/networks.ts` - Added stacks type and stacks:1/stacks:2147483648 networks
- `src/registries/simple-names.ts` - Added stacks name mappings
- `src/validation/address.ts` - Added stacks case to dispatcher
- `test/validation/address.test.ts` - Added Stacks cross-chain tests
- `test/integration.test.ts` - Updated error code coverage expectations

## Known Issues / Tech Debt

None. Implementation is complete and production-ready.

## Integration Points

**Upstream dependencies:**
- Phase 7 (Address Validation) - extends existing address validation pipeline
- c32check@2.0.0 - external library for c32 encoding (battle-tested, 123k weekly downloads)

**Downstream impacts:**
- Phase 13 (Manifest Validation) - can now validate Stacks endpoints in manifests
- Future Stacks-specific features (asset validation, contract calls) build on this foundation

**Cross-phase connections:**
- Follows exact pattern of EVM (Phase 7) and Solana (Phase 7) validators
- Network registry extensible for future chains
- Error code vocabulary consistent across all address validators

## Next Phase Readiness

**Phase 13 (Manifest Validation) prerequisites:**
- ✅ Stacks network registry entries exist
- ✅ Stacks address validation integrated into address dispatcher
- ✅ Error codes documented and tested
- ✅ All existing tests still pass (no regressions)

**Blockers:** None

**Concerns:** Bundle size (58.19 KB) is 29% over target but gzipped size (19.86 KB) remains excellent. May want to revisit if adding more chains pushes significantly higher.

## Commands Used

```bash
# Task 1: Install c32check and infrastructure
pnpm add -D c32check --filter x402check
pnpm tsc --noEmit --project packages/x402check
pnpm build --filter x402check

# Task 2: Implement validator and tests
pnpm test --filter x402check
pnpm build --filter x402check

# Verification
pnpm ls c32check --filter x402check
ls -la packages/x402check/dist/index.iife.js
```

## Test Results

```
Test Files: 24 passed (24)
Tests: 361 passed (361)
Duration: ~930ms

New Stacks tests: 20+
  - 5 valid address tests (SP, SM, ST, SN, with contract suffix)
  - 4 invalid format tests (empty, gibberish, wrong prefix, non-S)
  - 2 invalid checksum tests (corrupted checksum, invalid body)
  - 4 network mismatch tests (mainnet on testnet, testnet on mainnet, both P2PKH and P2SH)
  - 3 contract name handling tests
  - 2 integration tests (valid addresses on correct networks)
  - 2 cross-chain mismatch tests (Stacks vs EVM)
```

## Validation Against Must-Haves

✅ **All 6 truths verified:**
1. ✅ Stacks mainnet addresses (SP/SM) pass validation on stacks:1
2. ✅ Stacks testnet addresses (ST/SN) pass validation on stacks:2147483648
3. ✅ Invalid checksums produce "Double-check the address" error
4. ✅ Network mismatches produce error identifying direction (mainnet on testnet / testnet on mainnet)
5. ✅ Human-readable names (stacks:mainnet) rejected by CAIP-2 validation with fix suggesting numeric form
6. ✅ All 219 existing EVM/Solana tests still pass (zero regressions)

✅ **All 3 artifacts created:**
1. ✅ `packages/x402check/src/crypto/c32check.ts` exports decodeC32Address
2. ✅ `packages/x402check/src/validation/stacks-address.ts` exports validateStacksAddress
3. ✅ `packages/x402check/src/registries/networks.ts` contains stacks:1 and stacks:2147483648

✅ **All 3 key links verified:**
1. ✅ address.ts → stacks-address.ts via `case 'stacks'` in dispatcher
2. ✅ stacks-address.ts → c32check.ts via `import decodeC32Address`
3. ✅ networks.ts → `'stacks:1': { name: 'Stacks Mainnet', ... }`

## Lessons Learned

**What worked well:**
- Following existing EVM/Solana patterns made integration seamless
- c32check library's error handling was predictable and easy to wrap
- Network-aware validation caught by passing network parameter through dispatcher
- Test coverage strategy (valid/invalid/mismatch/cross-chain) caught all edge cases

**What could be improved:**
- Bundle size grew more than expected (c32check + base-x dependency chain)
- Could explore tree-shaking optimizations or selective function imports in future
- Test address generation required manual work (used c32check CLI to generate valid ST/SN addresses)

**For future chain additions:**
- Crypto wrapper pattern (crypto/c32check.ts) is proven and reusable
- Network-aware validation pattern (passing network param) should be standard for chains with network-specific address formats
- Simple name mappings in simple-names.ts registry enable helpful fix suggestions
- Integration test error code coverage enforcement catches missing tests early
