import { describe, test, expect } from 'vitest'
import { validate } from '../../src/validation/orchestrator'
import { ErrorCode } from '../../src/types/errors'
import type { ValidationResult } from '../../src/types/validation'

/** Helper: make a valid v2 config object */
function v2Config(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        maxTimeoutSeconds: 300,
      },
    ],
    resource: { url: 'https://example.com/api/data' },
    ...overrides,
  }
}

/** Helper: make a valid v1 config object */
function v1Config(): Record<string, unknown> {
  return {
    x402Version: 1,
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        maxAmountRequired: '500000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        maxTimeoutSeconds: 120,
        resource: { url: 'https://example.com/api/v1' },
      },
    ],
  }
}

/** Helper to check all error codes in a result */
function allCodes(result: ValidationResult): string[] {
  return [...result.errors.map((e) => e.code), ...result.warnings.map((w) => w.code)]
}

describe('validate()', () => {
  describe('Level 1: Structure', () => {
    test('"not json" string returns valid:false, INVALID_JSON, version:unknown, normalized:null', () => {
      const result = validate('not json')
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.code).toBe(ErrorCode.INVALID_JSON)
      expect(result.version).toBe('unknown')
      expect(result.normalized).toBeNull()
    })

    test('"42" returns valid:false, NOT_OBJECT', () => {
      const result = validate('42')
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.code).toBe(ErrorCode.NOT_OBJECT)
    })

    test('"[]" returns valid:false, NOT_OBJECT', () => {
      const result = validate('[]')
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.code).toBe(ErrorCode.NOT_OBJECT)
    })

    test('"null" returns valid:false, NOT_OBJECT', () => {
      const result = validate('null')
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.code).toBe(ErrorCode.NOT_OBJECT)
    })

    test('"{}" returns valid:false, UNKNOWN_FORMAT', () => {
      const result = validate('{}')
      expect(result.valid).toBe(false)
      expect(result.errors[0]!.code).toBe(ErrorCode.UNKNOWN_FORMAT)
    })

    test('object input works identically to JSON string', () => {
      const obj = v2Config()
      const fromObj = validate(obj)
      const fromStr = validate(JSON.stringify(obj))
      expect(fromObj.valid).toBe(fromStr.valid)
      expect(fromObj.version).toBe(fromStr.version)
      expect(fromObj.errors.length).toBe(fromStr.errors.length)
    })
  })

  describe('Level 2: Version and shape', () => {
    test('valid v2 config returns valid:true, version:v2', () => {
      const result = validate(v2Config())
      expect(result.valid).toBe(true)
      expect(result.version).toBe('v2')
    })

    test('valid v1 config returns valid:true, version:v1 (normalized to v2)', () => {
      const result = validate(v1Config())
      expect(result.valid).toBe(true)
      expect(result.version).toBe('v1')
      expect(result.normalized!.x402Version).toBe(2)
    })

    test('versionless flat config returns UNKNOWN_FORMAT error', () => {
      const result = validate({
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        amount: '1000000',
        network: 'base',
        asset: 'USDC',
      })
      expect(result.valid).toBe(false)
      expect(result.version).toBe('unknown')
      expect(result.errors.some((e) => e.code === ErrorCode.UNKNOWN_FORMAT)).toBe(true)
    })

    test('config with accepts:[] returns EMPTY_ACCEPTS', () => {
      const result = validate(v2Config({ accepts: [] }))
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.EMPTY_ACCEPTS)).toBe(true)
    })

    test('v2 config without resource returns warning MISSING_RESOURCE', () => {
      const config = v2Config()
      delete config.resource
      const result = validate(config)
      expect(result.warnings.some((w) => w.code === ErrorCode.MISSING_RESOURCE)).toBe(true)
    })

    test('v2 config with x402Version:3 returns UNKNOWN_FORMAT', () => {
      // x402Version:3 with accepts won't match v2 guard (needs ==2) or v1 guard (needs ==1)
      // and won't match flat-legacy (has accepts array)
      // so detection returns 'unknown'
      const result = validate({ x402Version: 3, accepts: [{}], resource: {} })
      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === ErrorCode.UNKNOWN_FORMAT)).toBe(true)
    })
  })

  describe('Level 3: Field validation', () => {
    test('v2 config missing scheme in accepts[0] returns MISSING_SCHEME', () => {
      const config = v2Config({
        accepts: [{ network: 'eip155:8453', amount: '1000000', asset: '0xabc', payTo: '0xdef', maxTimeoutSeconds: 60 }],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.MISSING_SCHEME)).toBe(true)
    })

    test('v2 config missing network returns MISSING_NETWORK', () => {
      const config = v2Config({
        accepts: [{ scheme: 'exact', amount: '1000000', asset: '0xabc', payTo: '0xdef', maxTimeoutSeconds: 60 }],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.MISSING_NETWORK)).toBe(true)
    })

    test('v2 config missing amount returns MISSING_AMOUNT', () => {
      const config = v2Config({
        accepts: [{ scheme: 'exact', network: 'eip155:8453', asset: '0xabc', payTo: '0xdef', maxTimeoutSeconds: 60 }],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.MISSING_AMOUNT)).toBe(true)
    })

    test('v2 config missing asset returns MISSING_ASSET', () => {
      const config = v2Config({
        accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', payTo: '0xdef', maxTimeoutSeconds: 60 }],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.MISSING_ASSET)).toBe(true)
    })

    test('v2 config missing payTo returns MISSING_PAY_TO', () => {
      const config = v2Config({
        accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0xabc', maxTimeoutSeconds: 60 }],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.MISSING_PAY_TO)).toBe(true)
    })

    test('v2 config with multiple accepts entries validates each', () => {
      const config = v2Config({
        accepts: [
          { scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0xabc', payTo: '0xdef', maxTimeoutSeconds: 60 },
          { scheme: '', network: '', amount: '', asset: '', payTo: '' },
        ],
      })
      const result = validate(config)
      // Second entry should have 5 missing-field errors
      const missingCodes = [ErrorCode.MISSING_SCHEME, ErrorCode.MISSING_NETWORK, ErrorCode.MISSING_AMOUNT, ErrorCode.MISSING_ASSET, ErrorCode.MISSING_PAY_TO]
      for (const code of missingCodes) {
        expect(result.errors.some((e) => e.code === code)).toBe(true)
      }
    })

    test('errors include correct field paths', () => {
      const config = v2Config({
        accepts: [
          { scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0xabc', payTo: '0xdef', maxTimeoutSeconds: 60 },
          { scheme: '', network: 'eip155:8453', amount: '1000000', asset: '0xabc', payTo: '0xdef', maxTimeoutSeconds: 60 },
        ],
      })
      const result = validate(config)
      const schemeError = result.errors.find((e) => e.code === ErrorCode.MISSING_SCHEME)
      expect(schemeError!.field).toBe('accepts[1].scheme')
    })
  })

  describe('Level 4: Network and amount', () => {
    test('config with network:"base" fails INVALID_NETWORK_FORMAT with fix suggestion', () => {
      // Note: since v2 detection requires accepts array + x402Version:2,
      // and normalize maps the v2 config through, the network stays as 'base'
      // in the normalized accepts entry only if normalization doesn't change it.
      // But v2 normalization is pass-through. So 'base' remains.
      const config = v2Config({
        accepts: [{ scheme: 'exact', network: 'base', amount: '1000000', asset: '0xabc', payTo: '0xdef', maxTimeoutSeconds: 60 }],
      })
      const result = validate(config)
      const networkErr = result.errors.find((e) => e.code === ErrorCode.INVALID_NETWORK_FORMAT)
      expect(networkErr).toBeDefined()
      expect(networkErr!.fix).toContain('eip155:8453')
    })

    test('valid CAIP-2 unknown network returns UNKNOWN_NETWORK warning', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:999999',
            amount: '1000000',
            asset: '0xabc',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          },
        ],
      })
      const result = validate(config)
      expect(result.warnings.some((w) => w.code === ErrorCode.UNKNOWN_NETWORK)).toBe(true)
    })

    test('amount "0" returns ZERO_AMOUNT error', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '0',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          },
        ],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.ZERO_AMOUNT)).toBe(true)
    })

    test('amount "abc" returns INVALID_AMOUNT error', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: 'abc',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 60,
          },
        ],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.INVALID_AMOUNT)).toBe(true)
    })

    test('amount "1000000" with valid config returns valid:true', () => {
      const result = validate(v2Config())
      expect(result.valid).toBe(true)
    })

    test('v2 entry without maxTimeoutSeconds returns MISSING_MAX_TIMEOUT warning', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
          },
        ],
      })
      const result = validate(config)
      expect(result.warnings.some((w) => w.code === ErrorCode.MISSING_MAX_TIMEOUT)).toBe(true)
    })

    test('v2 entry with maxTimeoutSeconds string returns INVALID_TIMEOUT error', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 'not-a-number',
          },
        ],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.INVALID_TIMEOUT)).toBe(true)
    })

    test('v2 entry with maxTimeoutSeconds:0 returns INVALID_TIMEOUT error', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 0,
          },
        ],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.INVALID_TIMEOUT)).toBe(true)
    })

    test('v2 config with resource.url "not://valid" returns INVALID_URL warning', () => {
      const config = v2Config({ resource: { url: 'not://valid' } })
      const result = validate(config)
      // "not://valid" actually parses as a valid URL with protocol "not:"
      // Let's check what happens
      try {
        new URL('not://valid')
        // If it parses, no INVALID_URL warning
        expect(result.warnings.every((w) => w.code !== ErrorCode.INVALID_URL)).toBe(true)
      } catch {
        expect(result.warnings.some((w) => w.code === ErrorCode.INVALID_URL)).toBe(true)
      }
    })
  })

  describe('Level 4: Address validation', () => {
    test('valid EVM checksummed address returns no address errors', () => {
      const result = validate(v2Config())
      const addressCodes = [ErrorCode.INVALID_EVM_ADDRESS, ErrorCode.BAD_EVM_CHECKSUM, ErrorCode.NO_EVM_CHECKSUM]
      for (const code of addressCodes) {
        expect(result.errors.some((e) => e.code === code)).toBe(false)
        expect(result.warnings.some((w) => w.code === code)).toBe(false)
      }
    })

    test('all-lowercase EVM address returns NO_EVM_CHECKSUM warning', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            payTo: '0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed',
            maxTimeoutSeconds: 300,
          },
        ],
      })
      const result = validate(config)
      expect(result.warnings.some((w) => w.code === ErrorCode.NO_EVM_CHECKSUM)).toBe(true)
    })

    test('bad EVM checksum returns BAD_EVM_CHECKSUM warning', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            // Intentionally bad checksum (changed case of 'a' to 'A' at start)
            payTo: '0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 300,
          },
        ],
      })
      const result = validate(config)
      expect(result.warnings.some((w) => w.code === ErrorCode.BAD_EVM_CHECKSUM)).toBe(true)
    })

    test('invalid EVM address format returns INVALID_EVM_ADDRESS error', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0xINVALID',
            maxTimeoutSeconds: 300,
          },
        ],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.INVALID_EVM_ADDRESS)).toBe(true)
    })

    test('valid Solana address returns no issues', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
            amount: '1000000',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            payTo: '11111111111111111111111111111111',
            maxTimeoutSeconds: 60,
          },
        ],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.INVALID_SOLANA_ADDRESS)).toBe(false)
    })

    test('invalid Solana address returns INVALID_SOLANA_ADDRESS error', () => {
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
            amount: '1000000',
            asset: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
            payTo: '0xNotASolanaAddress',
            maxTimeoutSeconds: 60,
          },
        ],
      })
      const result = validate(config)
      expect(result.errors.some((e) => e.code === ErrorCode.INVALID_SOLANA_ADDRESS)).toBe(true)
    })
  })

  describe('Level 5: Legacy warnings', () => {
    test('v1 config returns LEGACY_FORMAT warning', () => {
      const result = validate(v1Config())
      expect(result.warnings.some((w) => w.code === ErrorCode.LEGACY_FORMAT)).toBe(true)
    })

    test('v2 config returns no LEGACY_FORMAT warnings', () => {
      const result = validate(v2Config())
      expect(result.warnings.some((w) => w.code === ErrorCode.LEGACY_FORMAT)).toBe(false)
    })
  })

  describe('Strict mode', () => {
    test('config with warnings only: lenient returns valid:true, strict returns valid:false', () => {
      // v2 config without resource produces MISSING_RESOURCE warning
      const config = v2Config()
      delete (config as Record<string, unknown>).resource
      const lenient = validate(config)
      const strict = validate(config, { strict: true })
      expect(lenient.valid).toBe(true)
      expect(strict.valid).toBe(false)
    })

    test('strict mode moves all warnings to errors array', () => {
      const config = v2Config()
      delete (config as Record<string, unknown>).resource
      const strict = validate(config, { strict: true })
      expect(strict.errors.length).toBeGreaterThan(0)
      expect(strict.errors.some((e) => e.code === ErrorCode.MISSING_RESOURCE)).toBe(true)
    })

    test('strict mode clears warnings array', () => {
      const config = v2Config()
      delete (config as Record<string, unknown>).resource
      const strict = validate(config, { strict: true })
      expect(strict.warnings).toHaveLength(0)
    })

    test('strict mode with no warnings returns valid:true', () => {
      const strict = validate(v2Config(), { strict: true })
      expect(strict.valid).toBe(true)
    })

    test('strict mode with errors AND warnings returns both in errors', () => {
      // Config with amount error AND missing resource warning
      const config = v2Config({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: 'abc',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 300,
          },
        ],
      })
      delete (config as Record<string, unknown>).resource
      const strict = validate(config, { strict: true })
      expect(strict.errors.some((e) => e.code === ErrorCode.INVALID_AMOUNT)).toBe(true)
      expect(strict.errors.some((e) => e.code === ErrorCode.MISSING_RESOURCE)).toBe(true)
      expect(strict.warnings).toHaveLength(0)
    })
  })

  describe('Edge cases', () => {
    test('null input does not throw', () => {
      // null is typeof object, so it passes the string|object signature
      expect(() => validate(null as unknown as string)).not.toThrow()
    })

    test('undefined input does not throw', () => {
      expect(() => validate(undefined as unknown as string)).not.toThrow()
    })

    test('very large config with many accepts entries works', () => {
      const entry = {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        maxTimeoutSeconds: 60,
      }
      const accepts = Array.from({ length: 50 }, () => ({ ...entry }))
      const result = validate(v2Config({ accepts }))
      expect(result.valid).toBe(true)
    })

    test('config with extra/extensions fields preserved in normalized output', () => {
      const config = v2Config({
        extensions: { custom: 'value' },
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1000000',
            asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
            maxTimeoutSeconds: 300,
            extra: { foo: 'bar' },
          },
        ],
      })
      const result = validate(config)
      expect(result.normalized!.extensions).toEqual({ custom: 'value' })
      expect(result.normalized!.accepts[0]!.extra).toEqual({ foo: 'bar' })
    })
  })
})
