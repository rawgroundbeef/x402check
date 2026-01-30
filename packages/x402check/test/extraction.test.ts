import { describe, it, expect } from 'vitest'
import { extractConfig } from '../src/extraction'

const VALID_V2_CONFIG = {
  x402Version: 2,
  accepts: [{
    scheme: 'exact',
    network: 'eip155:8453',
    amount: '25000',
    asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    payTo: '0x1234567890abcdef1234567890abcdef12345678',
  }],
  resource: { url: 'https://example.com/api' },
}

function toBase64(obj: object): string {
  return btoa(JSON.stringify(obj))
}

describe('extractConfig', () => {
  describe('body extraction', () => {
    it('extracts config from parsed body object', () => {
      const result = extractConfig({ body: VALID_V2_CONFIG })
      expect(result.config).toEqual(VALID_V2_CONFIG)
      expect(result.source).toBe('body')
      expect(result.error).toBeNull()
    })

    it('extracts config from JSON string body', () => {
      const result = extractConfig({ body: JSON.stringify(VALID_V2_CONFIG) })
      expect(result.config).toEqual(VALID_V2_CONFIG)
      expect(result.source).toBe('body')
      expect(result.error).toBeNull()
    })

    it('detects body with payTo field (flat config)', () => {
      const flat = { payTo: '0x1234', amount: '100', network: 'eip155:8453' }
      const result = extractConfig({ body: flat })
      expect(result.config).toEqual(flat)
      expect(result.source).toBe('body')
    })

    it('detects body with x402Version field', () => {
      const partial = { x402Version: 2, accepts: [] }
      const result = extractConfig({ body: partial })
      expect(result.config).toEqual(partial)
      expect(result.source).toBe('body')
    })

    it('skips body with no x402 fields', () => {
      const result = extractConfig({
        body: { error: 'not found', status: 404 },
        headers: { 'payment-required': toBase64(VALID_V2_CONFIG) },
      })
      expect(result.source).toBe('header')
    })

    it('skips empty object body', () => {
      const result = extractConfig({
        body: {},
        headers: { 'payment-required': toBase64(VALID_V2_CONFIG) },
      })
      expect(result.source).toBe('header')
    })
  })

  describe('header extraction', () => {
    it('extracts base64-encoded config from PAYMENT-REQUIRED header', () => {
      const result = extractConfig({
        headers: { 'payment-required': toBase64(VALID_V2_CONFIG) },
      })
      expect(result.config).toEqual(VALID_V2_CONFIG)
      expect(result.source).toBe('header')
      expect(result.error).toBeNull()
    })

    it('handles case-insensitive header name (lowercase)', () => {
      const result = extractConfig({
        headers: { 'payment-required': toBase64(VALID_V2_CONFIG) },
      })
      expect(result.source).toBe('header')
    })

    it('handles case-insensitive header name (uppercase)', () => {
      const result = extractConfig({
        headers: { 'PAYMENT-REQUIRED': toBase64(VALID_V2_CONFIG) },
      })
      expect(result.source).toBe('header')
    })

    it('handles raw JSON in header (not base64)', () => {
      const result = extractConfig({
        headers: { 'payment-required': JSON.stringify(VALID_V2_CONFIG) },
      })
      expect(result.config).toEqual(VALID_V2_CONFIG)
      expect(result.source).toBe('header')
    })

    it('works with Headers object', () => {
      const headers = new Headers()
      headers.set('payment-required', toBase64(VALID_V2_CONFIG))
      const result = extractConfig({ headers })
      expect(result.config).toEqual(VALID_V2_CONFIG)
      expect(result.source).toBe('header')
    })
  })

  describe('fallback priority', () => {
    it('prefers body over header when body has x402 fields', () => {
      const headerConfig = { ...VALID_V2_CONFIG, x402Version: 1 as const }
      const result = extractConfig({
        body: VALID_V2_CONFIG,
        headers: { 'payment-required': toBase64(headerConfig) },
      })
      expect(result.source).toBe('body')
      expect((result.config as Record<string, unknown>).x402Version).toBe(2)
    })

    it('falls back to header when body is invalid JSON string', () => {
      const result = extractConfig({
        body: 'not json',
        headers: { 'payment-required': toBase64(VALID_V2_CONFIG) },
      })
      expect(result.source).toBe('header')
    })

    it('falls back to header when body is null', () => {
      const result = extractConfig({
        body: null,
        headers: { 'payment-required': toBase64(VALID_V2_CONFIG) },
      })
      expect(result.source).toBe('header')
    })

    it('falls back to header when body is an array', () => {
      const result = extractConfig({
        body: [1, 2, 3],
        headers: { 'payment-required': toBase64(VALID_V2_CONFIG) },
      })
      expect(result.source).toBe('header')
    })
  })

  describe('failure cases', () => {
    it('returns error when no config found anywhere', () => {
      const result = extractConfig({})
      expect(result.config).toBeNull()
      expect(result.source).toBeNull()
      expect(result.error).toBe('No x402 config found in response body or PAYMENT-REQUIRED header')
    })

    it('returns error when body has no x402 fields and no header', () => {
      const result = extractConfig({ body: { foo: 'bar' } })
      expect(result.config).toBeNull()
      expect(result.error).toBeTruthy()
    })

    it('returns error when header is invalid base64 and invalid JSON', () => {
      const result = extractConfig({
        headers: { 'payment-required': '!!!not-valid!!!' },
      })
      expect(result.config).toBeNull()
      expect(result.error).toBeTruthy()
    })

    it('returns error when header decodes to non-object', () => {
      const result = extractConfig({
        headers: { 'payment-required': btoa('"just a string"') },
      })
      expect(result.config).toBeNull()
    })

    it('returns error when header decodes to array', () => {
      const result = extractConfig({
        headers: { 'payment-required': btoa('[1,2,3]') },
      })
      expect(result.config).toBeNull()
    })
  })
})
