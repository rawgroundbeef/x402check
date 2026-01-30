import { describe, test, expect } from 'vitest'
import { validateLegacy } from '../../../src/validation/rules/legacy'
import { ErrorCode } from '../../../src/types/errors'
import type { NormalizedConfig } from '../../../src/types/config'

function makeConfig(): NormalizedConfig {
  return {
    x402Version: 2,
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0xabc', payTo: '0xdef' }],
  }
}

describe('validateLegacy', () => {
  test('flat-legacy format returns LEGACY_FORMAT warning with upgrade fix', () => {
    const issues = validateLegacy(makeConfig(), 'flat-legacy', {})
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.LEGACY_FORMAT)
    expect(issues[0]!.severity).toBe('warning')
    expect(issues[0]!.fix).toBeDefined()
  })

  test('v1 format returns LEGACY_FORMAT warning with v2 upgrade fix', () => {
    const issues = validateLegacy(makeConfig(), 'v1', {})
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.LEGACY_FORMAT)
    expect(issues[0]!.fix).toContain('amount instead of maxAmountRequired')
  })

  test('v2 format returns no legacy warnings', () => {
    const issues = validateLegacy(makeConfig(), 'v2', {})
    expect(issues).toHaveLength(0)
  })

  test('LEGACY_FORMAT warning has field "$"', () => {
    const issues = validateLegacy(makeConfig(), 'flat-legacy', {})
    expect(issues[0]!.field).toBe('$')
  })

  test('fix suggestion for flat-legacy mentions "accepts[] array"', () => {
    const issues = validateLegacy(makeConfig(), 'flat-legacy', {})
    expect(issues[0]!.fix).toContain('accepts[] array')
  })

  test('fix suggestion for v1 mentions "amount instead of maxAmountRequired"', () => {
    const issues = validateLegacy(makeConfig(), 'v1', {})
    expect(issues[0]!.fix).toContain('amount instead of maxAmountRequired')
  })
})
