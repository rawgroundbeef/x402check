import { describe, it, expect } from 'vitest'
import { detect, normalize } from '../src/index'
import type { NormalizedConfig } from '../src/index'

// ---- detect() tests ----

describe('detect', () => {
  describe('v2 format', () => {
    it('detects v2 config with accepts + x402Version:2 + resource', () => {
      expect(
        detect({
          x402Version: 2,
          accepts: [
            { scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' },
          ],
          resource: { url: 'https://example.com/api' },
        })
      ).toBe('v2')
    })

    it('detects v2 even without resource (resource absence is validation error, not detection)', () => {
      expect(
        detect({
          x402Version: 2,
          accepts: [
            { scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' },
          ],
        })
      ).toBe('v2')
    })

    it('detects v2 from JSON string', () => {
      const json = JSON.stringify({
        x402Version: 2,
        accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' }],
        resource: { url: 'https://example.com' },
      })
      expect(detect(json)).toBe('v2')
    })
  })

  describe('v1 format', () => {
    it('detects v1 config with accepts + x402Version:1', () => {
      expect(
        detect({
          x402Version: 1,
          accepts: [
            {
              scheme: 'exact',
              network: 'eip155:8453',
              maxAmountRequired: '100',
              asset: '0xabc',
              payTo: '0xdef',
            },
          ],
        })
      ).toBe('v1')
    })
  })

  describe('versionless configs are unknown', () => {
    it('returns unknown for flat config with payTo + amount + network (no x402Version)', () => {
      expect(
        detect({
          payTo: '0xabc',
          amount: '100',
          network: 'base',
        })
      ).toBe('unknown')
    })

    it('returns unknown for config with payments array (no x402Version)', () => {
      expect(
        detect({
          payments: [{ address: '0xabc', amount: '100', chain: 'base' }],
        })
      ).toBe('unknown')
    })
  })

  describe('unknown format', () => {
    it('returns unknown for empty object', () => {
      expect(detect({})).toBe('unknown')
    })

    it('returns unknown for invalid JSON string', () => {
      expect(detect('not json')).toBe('unknown')
    })

    it('returns unknown for array', () => {
      expect(detect('[]')).toBe('unknown')
    })

    it('returns unknown for null-ish JSON', () => {
      expect(detect('null')).toBe('unknown')
    })

    it('returns unknown for number', () => {
      expect(detect('42')).toBe('unknown')
    })
  })

  describe('manifest format', () => {
    it('detects manifest with endpoints collection', () => {
      expect(
        detect({
          endpoints: {
            'api-weather': {
              x402Version: 2,
              accepts: [
                { scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' },
              ],
              resource: { url: 'https://example.com/api/weather' },
            },
          },
        })
      ).toBe('manifest')
    })

    it('detects manifest before v2 even with x402Version: 2', () => {
      expect(
        detect({
          x402Version: 2,
          endpoints: {
            'api-weather': {
              x402Version: 2,
              accepts: [
                { scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' },
              ],
              resource: { url: 'https://example.com/api/weather' },
            },
          },
        })
      ).toBe('manifest')
    })

    it('detects empty manifest', () => {
      expect(detect({ endpoints: {} })).toBe('manifest')
    })
  })
})

// ---- normalize() tests ----

describe('normalize', () => {
  describe('v2 pass-through', () => {
    it('passes v2 config through with new object', () => {
      const input = {
        x402Version: 2 as const,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '100',
            asset: '0xabc',
            payTo: '0xdef',
            maxTimeoutSeconds: 30,
          },
        ],
        resource: { url: 'https://example.com/api' },
        extensions: { custom: true },
      }
      const result = normalize(input)
      expect(result).not.toBeNull()
      expect(result!.x402Version).toBe(2)
      expect(result!.accepts).toHaveLength(1)
      expect(result!.accepts[0]!.amount).toBe('100')
      expect(result!.resource).toEqual({ url: 'https://example.com/api' })
      expect(result!.extensions).toEqual({ custom: true })
      // Should be a new object, not same reference
      expect(result).not.toBe(input)
    })
  })

  describe('v1 to v2', () => {
    it('maps maxAmountRequired to amount', () => {
      const result = normalize({
        x402Version: 1,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            maxAmountRequired: '500',
            asset: '0xabc',
            payTo: '0xdef',
            resource: { url: 'https://example.com' },
          },
        ],
      })
      expect(result).not.toBeNull()
      expect(result!.x402Version).toBe(2)
      expect(result!.accepts[0]!.amount).toBe('500')
      expect(result!.accepts[0]).not.toHaveProperty('maxAmountRequired')
    })

    it('lifts per-entry resource to top level', () => {
      const result = normalize({
        x402Version: 1,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            maxAmountRequired: '500',
            asset: '0xabc',
            payTo: '0xdef',
            resource: { url: 'https://example.com' },
          },
        ],
      })
      expect(result!.resource).toEqual({ url: 'https://example.com' })
    })

    it('preserves extensions', () => {
      const result = normalize({
        x402Version: 1,
        accepts: [
          { scheme: 'exact', network: 'eip155:8453', maxAmountRequired: '100', asset: '0xabc', payTo: '0xdef' },
        ],
        extensions: { facilitator: 'custom' },
      })
      expect(result!.extensions).toEqual({ facilitator: 'custom' })
    })
  })

  describe('versionless configs return null', () => {
    it('returns null for flat config without x402Version', () => {
      expect(normalize({
        payTo: '0xdef',
        amount: '100',
        network: 'eip155:8453',
        asset: '0xabc',
      })).toBeNull()
    })

    it('returns null for config with payments array but no x402Version', () => {
      expect(normalize({
        payments: [{ address: '0xabc', amount: '100', chain: 'base' }],
      })).toBeNull()
    })
  })

  describe('unknown/garbage', () => {
    it('returns null for garbage input', () => {
      expect(normalize({})).toBeNull()
      expect(normalize('not json')).toBeNull()
      expect(normalize('null')).toBeNull()
      expect(normalize('42')).toBeNull()
    })
  })

  describe('string input (API-04)', () => {
    it('normalizes JSON string identically to object', () => {
      const obj = {
        x402Version: 2,
        accepts: [
          { scheme: 'exact', network: 'eip155:8453', amount: '100', asset: '0xabc', payTo: '0xdef' },
        ],
        resource: { url: 'https://example.com' },
      }
      const fromObj = normalize(obj)
      const fromStr = normalize(JSON.stringify(obj))
      expect(fromObj).toEqual(fromStr)
    })
  })
})
