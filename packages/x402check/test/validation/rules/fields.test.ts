import { describe, test, expect } from 'vitest'
import { validateFields, validateAccepts, validateResource } from '../../../src/validation/rules/fields'
import { ErrorCode } from '../../../src/types/errors'
import type { AcceptsEntry } from '../../../src/types/config'
import type { NormalizedConfig } from '../../../src/types/config'

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

function makeConfig(overrides: Partial<NormalizedConfig> = {}): NormalizedConfig {
  return {
    x402Version: 2,
    accepts: [makeEntry()],
    ...overrides,
  }
}

describe('validateFields', () => {
  test('entry missing scheme returns MISSING_SCHEME', () => {
    const entry = makeEntry({ scheme: '' })
    const issues = validateFields(entry, 'accepts[0]')
    expect(issues.some((i) => i.code === ErrorCode.MISSING_SCHEME)).toBe(true)
  })

  test('entry missing network returns MISSING_NETWORK', () => {
    const entry = makeEntry({ network: '' })
    const issues = validateFields(entry, 'accepts[0]')
    expect(issues.some((i) => i.code === ErrorCode.MISSING_NETWORK)).toBe(true)
  })

  test('entry missing amount returns MISSING_AMOUNT', () => {
    const entry = makeEntry({ amount: '' })
    const issues = validateFields(entry, 'accepts[0]')
    expect(issues.some((i) => i.code === ErrorCode.MISSING_AMOUNT)).toBe(true)
  })

  test('entry missing asset returns MISSING_ASSET', () => {
    const entry = makeEntry({ asset: '' })
    const issues = validateFields(entry, 'accepts[0]')
    expect(issues.some((i) => i.code === ErrorCode.MISSING_ASSET)).toBe(true)
  })

  test('entry missing payTo returns MISSING_PAY_TO', () => {
    const entry = makeEntry({ payTo: '' })
    const issues = validateFields(entry, 'accepts[0]')
    expect(issues.some((i) => i.code === ErrorCode.MISSING_PAY_TO)).toBe(true)
  })

  test('entry with empty string scheme returns MISSING_SCHEME', () => {
    const entry = makeEntry({ scheme: '' })
    const issues = validateFields(entry, 'accepts[0]')
    expect(issues[0]!.code).toBe(ErrorCode.MISSING_SCHEME)
    expect(issues[0]!.field).toBe('accepts[0].scheme')
  })

  test('complete entry returns no issues', () => {
    const issues = validateFields(makeEntry(), 'accepts[0]')
    expect(issues).toHaveLength(0)
  })

  test('entry missing all fields returns 5 issues', () => {
    const entry = makeEntry({ scheme: '', network: '', amount: '', asset: '', payTo: '' })
    const issues = validateFields(entry, 'accepts[0]')
    expect(issues).toHaveLength(5)
  })
})

describe('validateAccepts', () => {
  test('config without accepts returns INVALID_ACCEPTS', () => {
    // Force a config without accepts
    const config = { x402Version: 2 } as unknown as NormalizedConfig
    const issues = validateAccepts(config)
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_ACCEPTS)
  })

  test('config with empty accepts returns EMPTY_ACCEPTS', () => {
    const config = makeConfig({ accepts: [] })
    const issues = validateAccepts(config)
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.EMPTY_ACCEPTS)
  })

  test('config with valid accepts returns no issues', () => {
    const issues = validateAccepts(makeConfig())
    expect(issues).toHaveLength(0)
  })
})

describe('validateResource', () => {
  test('v2 config without resource returns MISSING_RESOURCE warning', () => {
    const config = makeConfig({ resource: undefined })
    const issues = validateResource(config, 'v2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.MISSING_RESOURCE)
    expect(issues[0]!.severity).toBe('warning')
  })

  test('config with valid URL returns no INVALID_URL issues', () => {
    const config = makeConfig({ resource: { url: 'https://example.com/api' } })
    const issues = validateResource(config, 'v2')
    expect(issues).toHaveLength(0)
  })

  test('config with malformed URL returns INVALID_URL warning', () => {
    const config = makeConfig({ resource: { url: 'not-a-url' } })
    const issues = validateResource(config, 'v2')
    expect(issues.some((i) => i.code === ErrorCode.INVALID_URL)).toBe(true)
    expect(issues.find((i) => i.code === ErrorCode.INVALID_URL)!.severity).toBe('warning')
  })

  test('config with empty-protocol URL returns INVALID_URL warning', () => {
    const config = makeConfig({ resource: { url: '://bad' } })
    const issues = validateResource(config, 'v2')
    expect(issues.some((i) => i.code === ErrorCode.INVALID_URL)).toBe(true)
  })

  test('config with resource.url empty string returns MISSING_RESOURCE warning', () => {
    const config = makeConfig({ resource: { url: '' } })
    const issues = validateResource(config, 'v2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.MISSING_RESOURCE)
    // Empty URL is caught as MISSING_RESOURCE, not INVALID_URL
    expect(issues.some((i) => i.code === ErrorCode.INVALID_URL)).toBe(false)
  })
})
