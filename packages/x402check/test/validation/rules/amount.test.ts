import { describe, test, expect } from 'vitest'
import { validateAmount, validateTimeout } from '../../../src/validation/rules/amount'
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

describe('validateAmount', () => {
  test('missing amount returns no issues (handled by fields)', () => {
    const entry = makeEntry({ amount: '' })
    const issues = validateAmount(entry, 'accepts[0]')
    expect(issues).toHaveLength(0)
  })

  test('valid numeric string returns no issues', () => {
    const issues = validateAmount(makeEntry({ amount: '1000000' }), 'accepts[0]')
    expect(issues).toHaveLength(0)
  })

  test('zero amount returns ZERO_AMOUNT error', () => {
    const issues = validateAmount(makeEntry({ amount: '0' }), 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.ZERO_AMOUNT)
  })

  test('decimal amount returns INVALID_AMOUNT error', () => {
    const issues = validateAmount(makeEntry({ amount: '10.5' }), 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_AMOUNT)
  })

  test('negative amount returns INVALID_AMOUNT error', () => {
    const issues = validateAmount(makeEntry({ amount: '-100' }), 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_AMOUNT)
  })

  test('scientific notation returns INVALID_AMOUNT error', () => {
    const issues = validateAmount(makeEntry({ amount: '1e6' }), 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_AMOUNT)
  })

  test('non-numeric string returns INVALID_AMOUNT error', () => {
    const issues = validateAmount(makeEntry({ amount: 'abc' }), 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_AMOUNT)
  })

  test('very large number (20+ digits) returns no issues', () => {
    const issues = validateAmount(makeEntry({ amount: '99999999999999999999999' }), 'accepts[0]')
    expect(issues).toHaveLength(0)
  })

  test('empty string returns no issues (handled by fields)', () => {
    const issues = validateAmount(makeEntry({ amount: '' }), 'accepts[0]')
    expect(issues).toHaveLength(0)
  })

  test('amount with spaces returns INVALID_AMOUNT error', () => {
    const issues = validateAmount(makeEntry({ amount: '100 000' }), 'accepts[0]')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_AMOUNT)
  })
})

describe('validateTimeout', () => {
  test('v2 entry without maxTimeoutSeconds returns MISSING_MAX_TIMEOUT warning', () => {
    const entry = makeEntry()
    // maxTimeoutSeconds is undefined by default from makeEntry
    const issues = validateTimeout(entry, 'accepts[0]', 'v2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.MISSING_MAX_TIMEOUT)
    expect(issues[0]!.severity).toBe('warning')
  })

  test('v2 entry with valid positive integer timeout returns no issues', () => {
    const entry = makeEntry({ maxTimeoutSeconds: 300 })
    const issues = validateTimeout(entry, 'accepts[0]', 'v2')
    expect(issues).toHaveLength(0)
  })

  test('entry with string timeout returns INVALID_TIMEOUT error', () => {
    const entry = makeEntry({ maxTimeoutSeconds: '300' as unknown as number })
    const issues = validateTimeout(entry, 'accepts[0]', 'v2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_TIMEOUT)
  })

  test('entry with zero timeout returns INVALID_TIMEOUT error', () => {
    const entry = makeEntry({ maxTimeoutSeconds: 0 })
    const issues = validateTimeout(entry, 'accepts[0]', 'v2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_TIMEOUT)
  })

  test('entry with negative timeout returns INVALID_TIMEOUT error', () => {
    const entry = makeEntry({ maxTimeoutSeconds: -5 })
    const issues = validateTimeout(entry, 'accepts[0]', 'v2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_TIMEOUT)
  })

  test('entry with float timeout returns INVALID_TIMEOUT error', () => {
    const entry = makeEntry({ maxTimeoutSeconds: 3.5 })
    const issues = validateTimeout(entry, 'accepts[0]', 'v2')
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_TIMEOUT)
  })
})
