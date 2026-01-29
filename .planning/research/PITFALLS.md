# Domain Pitfalls: x402check SDK Extraction

**Domain:** Extracting validation logic from a plain HTML/JS website into a standalone TypeScript npm package with zero runtime deps, vendored crypto, and UMD browser bundle
**Researched:** 2026-01-29
**Confidence:** HIGH (verified against official specs, real tsup/esbuild issues, and EIP-55 reference implementation)

---

## Critical Pitfalls

Mistakes that cause incorrect validation results, broken packages, or rewrites.

---

### Pitfall 1: Keccak-256 vs SHA-3 Confusion in Vendored EIP-55 Implementation

**What goes wrong:**
The vendored keccak256 implementation uses SHA-3 (the NIST-finalized standard) instead of Keccak-256 (the pre-NIST original). These produce completely different hashes. Every EVM address checksum computed with the wrong algorithm will be silently wrong -- some addresses will incorrectly pass, others will incorrectly fail. The validator becomes actively dangerous: it tells users their correctly checksummed addresses are wrong, or worse, tells them typo'd addresses are correct.

**Why it happens:**
Ethereum adopted Keccak-256 before NIST finalized SHA-3. NIST changed the padding scheme, so SHA-3-256 and Keccak-256 produce different outputs for the same input. Many libraries and documentation use "SHA-3" and "Keccak" interchangeably, which is incorrect. The current website uses `ethers.utils.getAddress()` which handles this correctly under the hood -- when replacing it with a vendored implementation, this distinction must be explicitly understood.

**Consequences:**
- Silent data corruption: checksums validate/invalidate incorrectly
- Users told their valid addresses are invalid (false negatives drive users away)
- Users told invalid addresses are valid (false positives could contribute to fund loss)
- Bug is invisible unless you test against known EIP-55 test vectors

**Prevention:**
1. Use a known-correct library for the keccak256 primitive. `js-sha3` (emn178/js-sha3) is zero-dependency, ~500 lines, MIT licensed, and explicitly provides `keccak_256` separate from `sha3_256`. It is the strongest candidate for vendoring or bundling.
2. NEVER use a library function named `sha3()` or `sha3_256()` for EIP-55. Always use the function explicitly named `keccak256` or `keccak_256`.
3. Add a canary test: hash an empty string and assert the result equals `c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470`. If it equals `a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a`, you are using SHA-3, not Keccak.
4. Hash the lowercase hex address string (ASCII bytes, without `0x` prefix). A common sub-bug is hashing the binary address bytes instead of the ASCII hex characters.

**Detection:**
- Run the empty-string canary test in CI
- Test against EIP-55 reference test vectors from the official spec
- Compare output against `ethers.utils.getAddress()` for a corpus of 100+ real addresses

**Which phase should address it:**
Phase 1 (Core crypto vendoring) -- this is the very first thing to get right, before any validation logic is built on top.

**Confidence:** HIGH -- verified against [EIP-55 specification](https://eips.ethereum.org/EIPS/eip-55) and [SHA3 vs Keccak-256 documentation](https://ethereumclassic.org/blog/2017-02-10-keccak/)

---

### Pitfall 2: Base58 Leading Zeros Bug in Vendored Solana Address Decoder

**What goes wrong:**
The vendored Base58 decoder fails to preserve leading zero bytes. In Base58, each leading `1` character represents a `0x00` byte. A decoder that only does the BigInt division but skips the leading-`1` counting step will produce output that is shorter than expected, causing valid Solana addresses to fail the 32-byte length check.

**Why it happens:**
Base58 is not a simple base conversion. The `1` character (value 0) at the start of the encoded string represents zero bytes that would be lost in a pure mathematical base conversion. This is the single most common bug in hand-rolled Base58 decoders. The current website uses regex-only validation (`/^[1-9A-HJ-NP-Za-km-z]{32,44}$/`) and loads `bs58@6.0.0` from CDN but does not actually decode addresses to verify byte length -- the SDK needs to do this properly.

**Consequences:**
- Valid Solana addresses starting with `1` characters (representing leading zero bytes) are rejected
- The 32-byte length check fails for addresses that are actually valid
- Solana address validation becomes unreliable

**Prevention:**
1. After BigInt division, count leading `1` characters in the input string and prepend that many `0x00` bytes to the decoded output
2. Verify decoded output is exactly 32 bytes for Solana public keys
3. Consider vendoring `base58-js` (~560 bytes, zero deps) rather than writing from scratch -- it handles leading zeros correctly
4. Test with addresses that have leading `1` characters (they exist in the wild)
5. Also test with the Solana genesis hash address and well-known program addresses

**Detection:**
- Unit test: encode a byte array starting with `[0, 0, 0, ...]`, decode the result, assert roundtrip equality
- Test the specific address `111111111111111111111111111111` (all 1s) -- should decode to 32 zero bytes
- Compare decode output against `bs58` library for a corpus of real Solana addresses

**Which phase should address it:**
Phase 1 (Core crypto vendoring) -- alongside keccak256, this is foundational.

**Confidence:** HIGH -- verified against [Base58 specification](https://ssojet.com/binary-encoding-decoding/base58-in-javascript-in-browser/) and [Solana address validation docs](https://www.npmjs.com/package/@solana/addresses)

---

### Pitfall 3: tsup Does Not Support UMD Format -- IIFE globalName Export Nesting

**What goes wrong:**
The PRD specifies a UMD bundle at `dist/x402check.umd.js` that exposes `window.x402Validate`. tsup does not support UMD format. It supports `iife` (IIFE), which is close but has a critical difference: with IIFE format and `globalName: 'x402Validate'`, the exports are nested as properties on the global object. So `window.x402Validate` becomes `{ validate: fn, detect: fn, normalize: fn }` -- but the website code expects `const { validate, detect, normalize } = window.x402Validate`, which actually works for this shape. The real problem is that default exports behave unexpectedly: if you use `export default`, the global becomes `{ default: fn, __esModule: true }` and you must access `window.x402Validate.default`.

**Why it happens:**
tsup uses esbuild under the hood, which wraps all exports in an IIFE and assigns them to the globalName as an object. There is no option to destructure exports directly onto `window`. This is a [known limitation](https://github.com/egoist/tsup/issues/1290) with no native fix. Developers who test only with ESM imports never discover this because the issue only manifests in `<script>` tag usage.

**Consequences:**
- Website integration breaks silently -- `window.x402Validate` exists but doesn't work as expected
- Hours of debugging why the browser bundle "doesn't export anything"
- May ship a broken CDN bundle that works in tests but fails in production

**Prevention:**
1. Do NOT use `export default` in the SDK's entry point. Use only named exports: `export { validate, detect, normalize }`. Named exports map cleanly to IIFE globalName properties.
2. Configure tsup with `format: ['esm', 'cjs', 'iife']`, `globalName: 'x402Validate'`, and `platform: 'browser'` for the IIFE build.
3. The website code `const { validate, detect, normalize } = window.x402Validate;` will work correctly with named exports under IIFE.
4. If UMD is truly needed (for AMD/RequireJS compatibility), add a separate Rollup build step or use `tsdown` (tsup successor) which supports UMD natively. For this project, IIFE is sufficient since the only browser consumer is a `<script>` tag.
5. Add an integration test that loads the IIFE bundle in a headless browser (or jsdom) and verifies `window.x402Validate.validate` is a function.

**Detection:**
- Build the IIFE bundle, load it in a browser console, check `typeof window.x402Validate.validate === 'function'`
- If it logs `undefined`, you have the export nesting problem
- CI test: load bundle in jsdom and assert exports exist

**Which phase should address it:**
Phase 2 (Build system setup) -- must be validated before website integration phase.

**Confidence:** HIGH -- verified against [tsup issue #924](https://github.com/egoist/tsup/issues/924) and [tsup issue #1290](https://github.com/egoist/tsup/issues/1290)

---

### Pitfall 4: package.json `exports` Types Resolution Breaks for Consumers

**What goes wrong:**
The published package works when imported, but TypeScript consumers get "Could not find a declaration file for module 'x402check'" or types resolve to `any`. The package appears broken even though the JavaScript works fine. This affects developer trust and adoption.

**Why it happens:**
TypeScript has multiple module resolution strategies (`Node`, `Node16`, `NodeNext`, `Bundler`) and each one interacts differently with the `exports` field in package.json. The most common mistakes:

1. Putting `"types"` after `"default"` in conditional exports (TypeScript stops at the first matching condition)
2. Not including separate `.d.mts` files for ESM consumers under `Node16`/`NodeNext` resolution
3. Having a top-level `"types"` field that conflicts with the `"exports"` field
4. Using `moduleResolution: "Node"` in the SDK's own tsconfig, which does not support the `exports` field at all

**Consequences:**
- TypeScript consumers get no types or wrong types
- Consumers using `moduleResolution: "Node16"` (increasingly common) see different behavior than `"Bundler"` consumers
- Hard to diagnose because it works for the author but fails for specific consumer configurations

**Prevention:**
1. Structure `exports` with `types` FIRST in each condition block:
   ```json
   {
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
     }
   }
   ```
2. Generate BOTH `.d.ts` (CJS) and `.d.mts` (ESM) declaration files. tsup's `--dts` flag handles this when `format` includes both `esm` and `cjs`.
3. Keep top-level `"types"`, `"main"`, and `"module"` fields as fallbacks for legacy resolution.
4. Run `npx @arethetypeswrong/cli --pack .` before every publish to catch resolution issues.
5. Run `npx publint` to validate package.json entry points.
6. Test imports under `node10`, `node16`, and `bundler` resolution modes.

**Detection:**
- `npx @arethetypeswrong/cli --pack .` reports no errors across all resolution modes
- Create a test consumer project with `moduleResolution: "Node16"` and verify `import { validate } from 'x402check'` resolves types
- `npx publint` reports no issues

**Which phase should address it:**
Phase 3 (Package configuration and publishing) -- but the exports structure should be planned from Phase 2.

**Confidence:** HIGH -- verified against [TypeScript ESM/CJS publishing guide](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing) and [@arethetypeswrong documentation](https://github.com/arethetypeswrong/arethetypeswrong.github.io)

---

## Moderate Pitfalls

Mistakes that cause delays, broken integrations, or significant rework.

---

### Pitfall 5: .gitignore Silently Excludes dist/ from npm Publish

**What goes wrong:**
`npm publish` produces a package with no `dist/` directory. The package installs fine but every import fails with "Cannot find module." This is the single most common reason published npm packages are broken on first publish.

**Why it happens:**
`dist/` is in `.gitignore` (correctly -- build artifacts should not be committed). When `package.json` has no `files` field, npm falls back to `.gitignore` to determine what to exclude. Since `dist/` is gitignored, it gets excluded from the published tarball. The developer runs `npm publish`, it succeeds, but the package is empty.

**Prevention:**
1. Always set `"files": ["dist"]` in package.json. This field is an allowlist that overrides `.gitignore`.
2. Always run `npm pack` and inspect the tarball contents before publishing: `npm pack && tar -tzf x402check-*.tgz`
3. Add a prepublish check script: `"prepublishOnly": "npm run build && npm pack --dry-run"`
4. Consider adding `.npmignore` as a belt-and-suspenders approach (but `files` is more reliable).

**Detection:**
- `npm pack --dry-run` shows whether `dist/` files are included
- If the tarball is suspiciously small (< 5KB for this project), something is missing

**Which phase should address it:**
Phase 3 (Publishing) -- but the `files` field should be set up in Phase 2 when package.json is created.

**Confidence:** HIGH -- verified against [npm documentation](https://jeremyrichardson.dev/blog/why-is-my-dist-directory-missing-from-my-package)

---

### Pitfall 6: EIP-55 Checksum Input Encoding -- Hashing Bytes vs ASCII String

**What goes wrong:**
The EIP-55 implementation hashes the raw address bytes (20 bytes) instead of the lowercase ASCII hex string (40 characters). Or it hashes the string WITH the `0x` prefix (42 characters) instead of WITHOUT (40 characters). Both produce completely wrong checksums.

**Why it happens:**
The EIP-55 spec says "hash the address." Developers interpret this as hashing the binary address data. But the spec means: take the lowercase hex representation (without `0x`), treat it as an ASCII string, and hash those ASCII bytes. The existing `validator.js` delegates to `ethers.utils.getAddress()` which handles this correctly. When replacing with a vendored implementation, this subtle encoding requirement must be replicated exactly.

**Prevention:**
1. The input to keccak256 must be the ASCII bytes of the lowercase hex string WITHOUT `0x` prefix.
   ```
   address = "0xAb5801a7D398351b8bE11C439e05C5b3259aec9B"
   input_to_hash = "ab5801a7d398351b8be11c439e05c5b3259aec9b"  // lowercase, no 0x
   hash = keccak256(input_to_hash)  // hash the STRING as ASCII bytes
   ```
2. Then for each character position i in the address:
   - If address[i] is a letter AND hash[i] >= 8, uppercase it
   - If address[i] is a digit, leave it unchanged
3. Test against the official EIP-55 test vectors from the [specification](https://eips.ethereum.org/EIPS/eip-55), which include:
   - `0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed`
   - `0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359`
   - `0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB`
   - `0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb`

**Detection:**
- Test all four EIP-55 reference addresses from the spec
- Test lowercase-only addresses (all lowercase should be accepted as valid without checksum warning)
- Test UPPERCASE-only addresses (should also be accepted as valid without checksum)
- Test a single wrong-case character and verify it fails checksum

**Which phase should address it:**
Phase 1 (Core crypto vendoring) -- part of the keccak256/EIP-55 implementation.

**Confidence:** HIGH -- verified against [EIP-55 specification](https://eips.ethereum.org/EIPS/eip-55)

---

### Pitfall 7: Website Integration Breaks Because ValidationResult Shape Changed

**What goes wrong:**
The SDK uses a new `ValidationResult` shape (as defined in the PRD: `valid`, `version`, `errors[]`, `warnings[]`, `normalized`) but the existing website's `displayResults()` function expects the old shape (`valid`, `detectedFormat`, `errors[]`, `warnings[]`, `normalized` with `.payments[]` and `._normalizedAmount`). The website loads the new UMD bundle, calls `validate()`, and gets back data it cannot render. The UI shows blank results or crashes with "Cannot read property 'payments' of undefined."

**Why it happens:**
The extraction changes the validation result structure to be spec-correct (e.g., `accepts` instead of `payments`, `payTo` instead of `address`, `amount` instead of `minAmount`). The website's rendering code in `index.html` directly references the old field names in multiple places: `validation.detectedFormat`, `validation.normalized.payments[0]`, `p.address`, `p.chain`, `p.minAmount`, `p._normalizedAmount`. All of these will break.

**Specific breaking changes from the PRD:**
- `detectedFormat` -> `version` (string values change: `'v2'` -> `'v2'` but `'flat'` -> `'flat-legacy'`)
- `normalized.payments` -> `normalized.accepts` (array rename)
- `payments[i].chain` -> `accepts[i].network` (CAIP-2 format)
- `payments[i].address` -> `accepts[i].payTo`
- `payments[i].minAmount` -> `accepts[i].amount`
- `payments[i].asset` -> `accepts[i].asset` (same name but now may be a contract address)
- `_normalizedAmount` internal property is removed
- `generateV2Equivalent()` is removed (normalization is built into `validate()`)

**Prevention:**
1. Map every field reference in `index.html` before starting integration. There are at least 15+ direct field references to update.
2. Consider adding a thin adapter layer in the website code that maps the new SDK shape to the old rendering expectations, rather than rewriting all rendering code at once.
3. Or, better: update the rendering code to use the new shape, since the website needs to reflect the new spec-correct field names anyway.
4. Test the full flow: load UMD bundle -> call validate with each example config -> verify all UI sections render correctly.

**Detection:**
- Load the website locally with the new UMD bundle substituted for the old scripts
- Paste each of the four example configs (flat, v1, v2, marketplace) and verify the results render
- Check browser console for any "Cannot read property" errors

**Which phase should address it:**
Phase 4 (Website integration) -- this is the core work of the integration phase and must be planned carefully.

**Confidence:** HIGH -- verified by reading the actual `index.html` rendering code and comparing against PRD types.

---

### Pitfall 8: Monorepo Workspace Breaks Root-Level Website Serving

**What goes wrong:**
After restructuring the repo to have `packages/x402check/` as a workspace, the root-level `index.html`, `validator.js`, `chains.js`, and `input.js` stop working or become confusing to maintain. npm/pnpm workspace configuration at the root may interfere with the flat file structure of the website. Running `npm install` at root level installs workspace dependencies but creates unexpected `node_modules` structures.

**Why it happens:**
The website is a plain HTML/JS site with no build process -- it just serves static files. Monorepo tooling (npm workspaces, pnpm workspaces) expects packages to be self-contained with their own `package.json`. Adding a root `package.json` with `"workspaces": ["packages/*"]` changes how `npm install` behaves for the entire repo. The website files at root level are not a "package" and may conflict with workspace resolution.

**Prevention:**
1. Keep the monorepo structure minimal. The root `package.json` only needs `"workspaces": ["packages/*"]` and dev scripts. The website files remain at root level unchanged.
2. Do NOT move website files into a `packages/website/` directory -- they are static HTML that gets served as-is. Overcomplicating the structure adds no value.
3. The website should continue to load the SDK via CDN `<script>` tag, not via workspace symlinks. The two are decoupled by design.
4. Add a `.npmrc` or configure the package manager to not hoist the SDK's dev dependencies into the root `node_modules`.
5. Test that the website still works by opening `index.html` directly in a browser after the monorepo restructuring.

**Detection:**
- After restructuring, `open index.html` in a browser and verify it loads without errors
- Check that `npm install` in the root does not create unexpected files in the website directory
- Verify `cd packages/x402check && npm test` works independently

**Which phase should address it:**
Phase 0 (Repository restructuring) -- this is the first step before any SDK code is written.

**Confidence:** MEDIUM -- based on common monorepo migration patterns, specific impact depends on chosen package manager.

---

### Pitfall 9: Solana Addresses Have No Checksum -- Validation Ceiling is Low

**What goes wrong:**
Developers spend time trying to implement "proper" Solana address validation with checksum verification, similar to EIP-55 for Ethereum. This effort is wasted because Solana addresses do NOT have checksums. A truncated or mistyped Solana address can still be valid Base58 and decode to 32 bytes. The validator cannot catch typos.

**Why it happens:**
Developers assume all blockchain addresses have some form of error detection (like Bitcoin's Base58Check or Ethereum's EIP-55). Solana uses raw Base58 without any checksum, which means the only validation possible is: (1) characters are valid Base58 alphabet, (2) decoded output is exactly 32 bytes. That is the ceiling. No typo detection is possible.

**Prevention:**
1. Accept the validation ceiling: for Solana, validation = valid Base58 + 32-byte decoded length. Document this limitation.
2. Do NOT promise "typo detection" for Solana addresses. The best the SDK can do is format validation.
3. Consider adding a warning in the validation result: "Solana addresses do not include checksums. Typos cannot be detected by format validation alone."
4. Focus effort on making EVM checksum validation excellent (where checksums exist and can catch errors), rather than over-investing in Solana validation.

**Detection:**
- Review: does the Solana validation code try to do more than Base58 + length check? If so, it may be doing unnecessary work or giving false confidence.

**Which phase should address it:**
Phase 1 (Validation rules implementation) -- set expectations correctly from the start.

**Confidence:** HIGH -- verified against [Solana discussion on Base58Check](https://github.com/solana-labs/solana/issues/6970)

---

## Minor Pitfalls

Mistakes that cause annoyance, confusion, or minor rework.

---

### Pitfall 10: Vendored Code Diverges from Upstream Without Audit Trail

**What goes wrong:**
The vendored `js-sha3` keccak256 or Base58 decoder is modified slightly during integration (e.g., converting from CommonJS to ESM, removing unused functions, changing variable names). Over time, nobody remembers what was changed from the upstream source. When a security issue is found in the upstream library, it is unclear whether the vendored version is affected.

**Prevention:**
1. Add a comment block at the top of each vendored file: original library name, version, URL, date vendored, and list of modifications.
2. Keep vendored code in a dedicated `src/vendor/` directory, separate from project code.
3. Prefer extracting only the needed function (e.g., only `keccak_256` from js-sha3) rather than vendoring the entire library -- less surface area to audit.
4. If the vendored code is small enough (~50-100 lines for Base58), write it from scratch with tests rather than vendoring -- then there is no upstream to track.

**Which phase should address it:**
Phase 1 (Core crypto vendoring) -- establish the vendoring convention immediately.

---

### Pitfall 11: IIFE Bundle Includes Node.js-Specific Code Paths

**What goes wrong:**
The IIFE bundle for browsers includes `Buffer`, `process`, or `require()` references that fail in the browser. The bundle loads but throws at runtime when these Node.js globals are undefined.

**Prevention:**
1. Set `platform: 'browser'` in the tsup config for the IIFE build.
2. Use `Uint8Array` instead of `Buffer` everywhere in the vendored crypto code. `Buffer` is Node-only; `Uint8Array` works in both environments.
3. Use `TextEncoder` for string-to-bytes conversion instead of `Buffer.from()`.
4. Add a CI test that loads the IIFE bundle in a browser-like environment (jsdom) and verifies no `Buffer`/`process`/`require` references exist.

**Which phase should address it:**
Phase 2 (Build system) -- configure the IIFE build correctly from the start.

---

### Pitfall 12: npm Package Name Squatting / Availability

**What goes wrong:**
The team builds the entire SDK under the name `x402check`, then at publish time discovers the name is already taken on npm. All documentation, imports, and references must be changed.

**Prevention:**
1. Check `npm view x402check` BEFORE writing any code. If it returns a 404, the name is available.
2. Have a backup name ready (e.g., `@x402/check`, `x402-validate`, `x402check-sdk`).
3. Consider using a scoped package name (`@x402check/core`) which is always available if you own the org.

**Which phase should address it:**
Phase 0 (Planning) -- verify name availability before any code is written.

---

### Pitfall 13: Test Fixtures Drift from Actual x402 Spec

**What goes wrong:**
Test fixtures are hand-crafted to match the team's understanding of the spec, not the actual spec. The SDK validates against the fixtures perfectly but fails on real-world x402 configs from live endpoints.

**Prevention:**
1. Include real-world configs from actual x402 endpoints in the test fixtures (the existing `token-data-aggregator` endpoint response should be captured).
2. Periodically fetch live configs and run them through the validator to catch drift.
3. Reference the canonical x402 spec from [coinbase/x402](https://github.com/coinbase/x402) when creating fixtures, not the existing website's interpretation.
4. The PRD already documents specific spec mismatches (e.g., `payments` vs `accepts`, `address` vs `payTo`) -- use these as a checklist.

**Which phase should address it:**
Phase 1 (Validation rules) -- fixtures should be created from the spec, not from assumptions.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Repo restructuring | Workspace config breaks website serving | Keep website at root, test `open index.html` after restructuring |
| Crypto vendoring | Keccak-256 vs SHA-3 confusion | Empty-string canary test, EIP-55 reference vectors |
| Crypto vendoring | Base58 leading zeros | Roundtrip test with leading-zero byte arrays |
| Build system | tsup IIFE export nesting | Use named exports only, test `window.x402Validate.validate` in browser |
| Build system | Node.js code in browser bundle | Set `platform: 'browser'`, use Uint8Array not Buffer |
| Package config | Types not resolving for consumers | Run `arethetypeswrong` before every publish |
| Package config | dist/ excluded from publish | Set `"files": ["dist"]`, run `npm pack --dry-run` |
| Website integration | ValidationResult shape mismatch | Map every field reference in index.html before starting |
| Publishing | Package name taken | Check `npm view x402check` before writing code |
| Ongoing | Vendored code diverges silently | Header comments with upstream source, version, modifications |

## "Looks Done But Isn't" Checklist

Before considering the SDK extraction complete:

- [ ] **Keccak canary:** Empty string hashes to `c5d2460...` not `a7ffc6f...`
- [ ] **EIP-55 vectors:** All four reference addresses from the EIP-55 spec pass
- [ ] **Base58 leading zeros:** Address starting with `1` characters decodes correctly
- [ ] **Base58 roundtrip:** Encode then decode produces identical bytes
- [ ] **IIFE bundle:** `window.x402Validate.validate` is a function in browser console
- [ ] **IIFE bundle:** No `Buffer`, `process`, or `require` references in bundle
- [ ] **Types resolution:** `arethetypeswrong --pack .` passes for node10, node16, bundler
- [ ] **Package contents:** `npm pack --dry-run` includes all dist/ files
- [ ] **Website renders:** All 4 example configs produce correct UI output with new SDK
- [ ] **Real-world config:** Live endpoint config validates correctly
- [ ] **Solana validation ceiling:** No false promises about typo detection in docs/comments
- [ ] **Export shape:** No `export default` in entry point (breaks IIFE globalName)

## Sources

### EIP-55 and Keccak-256
- [EIP-55 Specification](https://eips.ethereum.org/EIPS/eip-55)
- [SHA3 vs Keccak-256 Explanation](https://ethereumclassic.org/blog/2017-02-10-keccak/)
- [SHA3 vs Keccak-256 Technical Diff](https://byteatatime.dev/posts/sha3-vs-keccak256/)
- [EIP-55 Implementation Guide](https://narteysarso.hashnode.dev/ethereum-address-encoding-and-verification-eip-55)
- [js-sha3 Library](https://github.com/emn178/js-sha3)

### Base58 and Solana
- [Solana Base58Check Discussion](https://github.com/solana-labs/solana/issues/6970)
- [@solana/addresses Package](https://www.npmjs.com/package/@solana/addresses)
- [Base58 in JavaScript](https://ssojet.com/binary-encoding-decoding/base58-in-javascript-in-browser/)
- [base58-js (560 bytes)](https://www.npmjs.com/package/base58-js)

### tsup and Build Tooling
- [tsup UMD Support Issue #924](https://github.com/egoist/tsup/issues/924)
- [tsup IIFE globalName Issue #1290](https://github.com/egoist/tsup/issues/1290)
- [esbuild globalName and Default Exports Issue #3740](https://github.com/evanw/esbuild/issues/3740)

### TypeScript Package Publishing
- [TypeScript ESM/CJS Publishing Guide](https://lirantal.com/blog/typescript-in-2025-with-esm-and-cjs-npm-publishing)
- [Are The Types Wrong CLI](https://github.com/arethetypeswrong/arethetypeswrong.github.io)
- [package.json exports field guide](https://hirok.io/posts/package-json-exports)
- [publint - Package Linter](https://publint.dev/)
- [Dual Publishing with tsup](https://johnnyreilly.com/dual-publishing-esm-cjs-modules-with-tsup-and-are-the-types-wrong)

### npm Publishing
- [Why dist/ is Missing From Packages](https://jeremyrichardson.dev/blog/why-is-my-dist-directory-missing-from-my-package)
- [npm publish files field issue](https://github.com/npm/npm/issues/3571)

### Monorepo Migration
- [Node.js Monolith to Monorepo](https://www.infoq.com/articles/nodejs-monorepo/)
- [Complete Monorepo Guide 2025](https://jsdev.space/complete-monorepo-guide/)
- [npm Workspaces for Monorepos](https://medium.com/edgybees-blog/how-to-move-from-an-existing-repository-to-a-monorepo-using-npm-7-workspaces-27012a100269)

---
*Pitfalls research for: x402check SDK extraction milestone*
*Researched: 2026-01-29*
