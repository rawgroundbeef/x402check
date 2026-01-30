import { describe, test, expect } from 'vitest'
import { validateVersion } from '../../../src/validation/rules/version'
import { ErrorCode } from '../../../src/types/errors'
import type { NormalizedConfig } from '../../../src/types/config'

function makeConfig(overrides: Partial<NormalizedConfig> = {}): NormalizedConfig {
  return {
    x402Version: 2,
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0xabc', payTo: '0xdef' }],
    ...overrides,
  }
}

describe('validateVersion', () => {
  test('x402Version:2 returns no issues', () => {
    const issues = validateVersion(makeConfig(), 'v2')
    expect(issues).toHaveLength(0)
  })

  test('x402Version:3 returns INVALID_VERSION error', () => {
    // Cast to bypass type checking -- runtime value could be anything
    const config = makeConfig({ x402Version: 3 as unknown as 2 })
    const issues = validateVersion(config, 'v2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_VERSION)
  })

  test('x402Version:0 returns INVALID_VERSION error', () => {
    const config = makeConfig({ x402Version: 0 as unknown as 2 })
    const issues = validateVersion(config, 'v2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_VERSION)
  })

  test('x402Version:1 from v1 normalization returns no issues', () => {
    // After normalize(), v1 configs become x402Version: 2
    // But if somehow x402Version is 1, it should still be valid
    const config = makeConfig({ x402Version: 1 as unknown as 2 })
    const issues = validateVersion(config, 'v1')
    expect(issues).toHaveLength(0)
  })
})
