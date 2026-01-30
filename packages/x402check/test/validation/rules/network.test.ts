import { describe, test, expect } from 'vitest'
import { validateNetwork, validateAsset } from '../../../src/validation/rules/network'
import { ErrorCode } from '../../../src/types/errors'
import type { AcceptsEntry } from '../../../src/types/config'

function makeEntry(overrides: Partial<AcceptsEntry> = {}): AcceptsEntry {
  return {
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '1000000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    ...overrides,
  }
}

describe('validateNetwork', () => {
  test('missing network returns no issues (handled by fields)', () => {
    const entry = makeEntry({ network: '' })
    const issues = validateNetwork(entry, 'accepts[0]')
    expect(issues).toHaveLength(0)
  })

  test('valid CAIP-2 known network returns no issues', () => {
    const issues = validateNetwork(makeEntry(), 'accepts[0]')
    expect(issues).toHaveLength(0)
  })

  test('valid CAIP-2 unknown network returns UNKNOWN_NETWORK warning', () => {
    const entry = makeEntry({ network: 'eip155:999999' })
    const issues = validateNetwork(entry, 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.UNKNOWN_NETWORK)
    expect(issues[0]!.severity).toBe('warning')
  })

  test('invalid CAIP-2 with simple name "base" returns INVALID_NETWORK_FORMAT error with fix', () => {
    const entry = makeEntry({ network: 'base' })
    const issues = validateNetwork(entry, 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_NETWORK_FORMAT)
    expect(issues[0]!.severity).toBe('error')
    expect(issues[0]!.fix).toContain('eip155:8453')
  })

  test('invalid CAIP-2 with simple name "solana" returns fix suggestion', () => {
    const entry = makeEntry({ network: 'solana' })
    const issues = validateNetwork(entry, 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_NETWORK_FORMAT)
    expect(issues[0]!.fix).toContain('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
  })

  test('invalid CAIP-2 with unknown simple name returns error without fix', () => {
    const entry = makeEntry({ network: 'unknownchain' })
    const issues = validateNetwork(entry, 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_NETWORK_FORMAT)
    expect(issues[0]!.fix).toBeUndefined()
  })

  test('network with correct CAIP-2 format but empty reference rejected', () => {
    // "eip155:" has empty reference which is <1 character -- fails regex
    const entry = makeEntry({ network: 'eip155:' })
    const issues = validateNetwork(entry, 'accepts[0]')
    expect(issues.some((i) => i.code === ErrorCode.INVALID_NETWORK_FORMAT)).toBe(true)
  })
})

describe('validateAsset', () => {
  test('known asset on known network returns no issues', () => {
    const issues = validateAsset(makeEntry(), 'accepts[0]')
    expect(issues).toHaveLength(0)
  })

  test('unknown asset returns UNKNOWN_ASSET warning', () => {
    const entry = makeEntry({ asset: '0x0000000000000000000000000000000000000001' })
    const issues = validateAsset(entry, 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.UNKNOWN_ASSET)
    expect(issues[0]!.severity).toBe('warning')
  })

  test('missing asset returns no issues (handled by fields)', () => {
    const entry = makeEntry({ asset: '' })
    const issues = validateAsset(entry, 'accepts[0]')
    expect(issues).toHaveLength(0)
  })
})
