import { describe, test, expect } from 'vitest'
import { validateStructure } from '../../../src/validation/rules/structure'
import { ErrorCode } from '../../../src/types/errors'

describe('validateStructure', () => {
  test('invalid JSON string returns INVALID_JSON error', () => {
    const result = validateStructure('not valid json {{{')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]!.code).toBe(ErrorCode.INVALID_JSON)
    expect(result.parsed).toBeNull()
    expect(result.format).toBe('unknown')
  })

  test('JSON number returns NOT_OBJECT error', () => {
    const result = validateStructure('42')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]!.code).toBe(ErrorCode.NOT_OBJECT)
    expect(result.parsed).toBeNull()
  })

  test('JSON array returns NOT_OBJECT error', () => {
    const result = validateStructure('[]')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]!.code).toBe(ErrorCode.NOT_OBJECT)
    expect(result.parsed).toBeNull()
  })

  test('JSON null returns NOT_OBJECT error', () => {
    const result = validateStructure('null')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]!.code).toBe(ErrorCode.NOT_OBJECT)
    expect(result.parsed).toBeNull()
  })

  test('empty object returns UNKNOWN_FORMAT error', () => {
    const result = validateStructure('{}')
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]!.code).toBe(ErrorCode.UNKNOWN_FORMAT)
    expect(result.format).toBe('unknown')
  })

  test('valid v2 object returns format v2 with no issues', () => {
    const result = validateStructure({
      x402Version: 2,
      accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0xabc', payTo: '0xdef' }],
      resource: { url: 'https://example.com' },
    })
    expect(result.issues).toHaveLength(0)
    expect(result.format).toBe('v2')
    expect(result.parsed).not.toBeNull()
  })

  test('valid v1 object returns format v1 with no issues', () => {
    const result = validateStructure({
      x402Version: 1,
      accepts: [{ scheme: 'exact', network: 'eip155:8453', maxAmountRequired: '500000', asset: '0xabc', payTo: '0xdef' }],
    })
    expect(result.issues).toHaveLength(0)
    expect(result.format).toBe('v1')
  })

  test('versionless flat object returns UNKNOWN_FORMAT error', () => {
    const result = validateStructure({
      payTo: '0xabc',
      amount: '1000000',
      network: 'base',
      asset: 'USDC',
    })
    expect(result.issues).toHaveLength(1)
    expect(result.issues[0]!.code).toBe(ErrorCode.UNKNOWN_FORMAT)
    expect(result.format).toBe('unknown')
  })
})
