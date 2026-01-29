import { describe, it, expect } from 'vitest'
import {
  ErrorCode,
  ErrorMessages,
  parseInput,
  VERSION,
} from '../src/index'
import type {
  ConfigFormat,
  ValidationResult,
  ValidationIssue,
  V2Config,
  NormalizedConfig,
} from '../src/index'

describe('ErrorCode', () => {
  it('exports all error code constants', () => {
    expect(ErrorCode.INVALID_JSON).toBe('INVALID_JSON')
    expect(ErrorCode.MISSING_SCHEME).toBe('MISSING_SCHEME')
    expect(ErrorCode.INVALID_NETWORK_FORMAT).toBe('INVALID_NETWORK_FORMAT')
    expect(ErrorCode.UNKNOWN_NETWORK).toBe('UNKNOWN_NETWORK')
    expect(ErrorCode.LEGACY_FORMAT).toBe('LEGACY_FORMAT')
  })

  it('has a message for every error code', () => {
    const codes = Object.values(ErrorCode)
    for (const code of codes) {
      expect(ErrorMessages[code]).toBeDefined()
      expect(typeof ErrorMessages[code]).toBe('string')
      expect(ErrorMessages[code].length).toBeGreaterThan(0)
    }
  })
})

describe('parseInput', () => {
  it('parses valid JSON string', () => {
    const result = parseInput('{"x402Version": 2}')
    expect(result.parsed).toEqual({ x402Version: 2 })
    expect(result.error).toBeUndefined()
  })

  it('returns error for invalid JSON string', () => {
    const result = parseInput('not json')
    expect(result.parsed).toBeNull()
    expect(result.error).toBeDefined()
    expect(result.error!.code).toBe(ErrorCode.INVALID_JSON)
    expect(result.error!.field).toBe('$')
    expect(result.error!.severity).toBe('error')
  })

  it('passes through object input unchanged', () => {
    const obj = { x402Version: 2, accepts: [] }
    const result = parseInput(obj)
    expect(result.parsed).toBe(obj) // same reference
    expect(result.error).toBeUndefined()
  })

  it('handles empty JSON string', () => {
    const result = parseInput('')
    expect(result.error).toBeDefined()
    expect(result.error!.code).toBe(ErrorCode.INVALID_JSON)
  })
})
