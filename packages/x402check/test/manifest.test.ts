import { describe, it, expect } from 'vitest'
import { detect, isManifestConfig } from '../src/index'
import { normalizeWildManifest } from '../src/detection'
import type { ManifestConfig, V2Config } from '../src/index'

/**
 * Helper to build a valid V2Config endpoint for reuse across tests
 */
function makeEndpoint(overrides?: Partial<V2Config>): V2Config {
  return {
    x402Version: 2,
    accepts: [
      {
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '100',
        asset: '0xabc',
        payTo: '0xdef',
      },
    ],
    resource: { url: 'https://example.com/api' },
    ...overrides,
  }
}

describe('isManifestConfig', () => {
  it('returns true for manifest with single endpoint', () => {
    expect(
      isManifestConfig({
        endpoints: {
          'weather-api': makeEndpoint(),
        },
      })
    ).toBe(true)
  })

  it('returns true for manifest with multiple endpoints', () => {
    expect(
      isManifestConfig({
        endpoints: {
          weather: makeEndpoint({ resource: { url: 'https://example.com/weather' } }),
          data: makeEndpoint({ resource: { url: 'https://example.com/data' } }),
          sports: makeEndpoint({ resource: { url: 'https://example.com/sports' } }),
        },
      })
    ).toBe(true)
  })

  it('returns true for empty endpoints (allows initialization)', () => {
    expect(isManifestConfig({ endpoints: {} })).toBe(true)
  })

  it('returns true for manifest with optional service metadata', () => {
    expect(
      isManifestConfig({
        service: {
          name: 'Weather Service',
          description: 'Weather data APIs',
          version: '1.0.0',
        },
        endpoints: {
          weather: makeEndpoint(),
        },
      })
    ).toBe(true)
  })

  it('returns true for manifest with x402Version: 2 at manifest level', () => {
    expect(
      isManifestConfig({
        x402Version: 2,
        endpoints: {
          weather: makeEndpoint(),
        },
      })
    ).toBe(true)
  })

  it('returns false for standard v2 config (has accepts at root, not endpoints)', () => {
    expect(isManifestConfig(makeEndpoint())).toBe(false)
  })

  it('returns false for v1 config', () => {
    expect(
      isManifestConfig({
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
    ).toBe(false)
  })

  it('returns false for empty object {}', () => {
    expect(isManifestConfig({})).toBe(false)
  })

  it('returns false for array input', () => {
    expect(isManifestConfig([makeEndpoint()])).toBe(false)
  })

  it('returns false for null', () => {
    expect(isManifestConfig(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isManifestConfig(undefined)).toBe(false)
  })

  it('returns false if endpoints is an array (must be Record)', () => {
    expect(isManifestConfig({ endpoints: [makeEndpoint()] })).toBe(false)
  })

  it('returns false if endpoints is a string', () => {
    expect(isManifestConfig({ endpoints: 'weather' })).toBe(false)
  })

  it('returns false if any endpoint value is not an object', () => {
    expect(
      isManifestConfig({
        endpoints: {
          weather: 'not an object',
        },
      })
    ).toBe(false)
  })

  it('returns false if any endpoint value lacks accepts array', () => {
    expect(
      isManifestConfig({
        endpoints: {
          weather: {
            x402Version: 2,
            resource: { url: 'https://example.com' },
            // missing accepts
          },
        },
      })
    ).toBe(false)
  })
})

describe('detect manifest format', () => {
  it('returns manifest for canonical manifest object', () => {
    expect(
      detect({
        endpoints: {
          'api-weather': makeEndpoint({ resource: { url: 'https://example.com/weather' } }),
        },
      })
    ).toBe('manifest')
  })

  it('returns manifest for manifest JSON string', () => {
    const manifest = {
      endpoints: {
        'api-weather': makeEndpoint(),
      },
    }
    expect(detect(JSON.stringify(manifest))).toBe('manifest')
  })

  it('returns manifest for manifest with x402Version: 2 (does NOT return v2)', () => {
    expect(
      detect({
        x402Version: 2,
        endpoints: {
          weather: makeEndpoint(),
        },
      })
    ).toBe('manifest')
  })

  it('returns manifest for empty endpoints ({})', () => {
    expect(detect({ endpoints: {} })).toBe('manifest')
  })

  it('returns manifest for manifest with service metadata', () => {
    expect(
      detect({
        service: {
          name: 'Weather API',
          version: '1.0.0',
        },
        endpoints: {
          weather: makeEndpoint(),
        },
      })
    ).toBe('manifest')
  })

  it('returns v2 for standard v2 config (no endpoints key, has accepts at root)', () => {
    expect(detect(makeEndpoint())).toBe('v2')
  })

  it('returns v2 for v2 config that has non-Record endpoints field', () => {
    // If endpoints is not a Record, it falls through manifest guard
    expect(
      detect({
        x402Version: 2,
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '100',
            asset: '0xabc',
            payTo: '0xdef',
          },
        ],
        resource: { url: 'https://example.com' },
        endpoints: 'not-a-record', // invalid endpoints field
      })
    ).toBe('v2')
  })
})

describe('normalizeWildManifest', () => {
  describe('array-style normalization', () => {
    it('normalizes { paymentEndpoints: [...] } to canonical shape', () => {
      const config1 = makeEndpoint({ resource: { url: 'https://example.com/api/weather' } })
      const config2 = makeEndpoint({ resource: { url: 'https://example.com/api/data' } })

      const result = normalizeWildManifest({ paymentEndpoints: [config1, config2] })

      expect(result).not.toBeNull()
      expect(result!.manifest.endpoints).toBeDefined()
      expect(Object.keys(result!.manifest.endpoints)).toHaveLength(2)
      expect(result!.warnings).toHaveLength(1)
      expect(result!.warnings[0]!.code).toBe('WILD_MANIFEST_ARRAY_FORMAT')
      expect(result!.warnings[0]!.field).toBe('paymentEndpoints')
    })

    it('normalizes { payments: [...] } to canonical shape', () => {
      const config1 = makeEndpoint()

      const result = normalizeWildManifest({ payments: [config1] })

      expect(result).not.toBeNull()
      expect(result!.manifest.endpoints).toBeDefined()
      expect(Object.keys(result!.manifest.endpoints)).toHaveLength(1)
      expect(result!.warnings[0]!.field).toBe('payments')
    })

    it('normalizes { configs: [...] } to canonical shape', () => {
      const config1 = makeEndpoint()
      const config2 = makeEndpoint()
      const config3 = makeEndpoint()

      const result = normalizeWildManifest({ configs: [config1, config2, config3] })

      expect(result).not.toBeNull()
      expect(Object.keys(result!.manifest.endpoints)).toHaveLength(3)
      expect(result!.warnings[0]!.field).toBe('configs')
    })

    it('generates endpoint IDs from resource URLs when available', () => {
      const config1 = makeEndpoint({ resource: { url: 'https://example.com/api/weather' } })
      const config2 = makeEndpoint({ resource: { url: 'https://example.com/api/data/sports' } })

      const result = normalizeWildManifest({ paymentEndpoints: [config1, config2] })

      expect(result).not.toBeNull()
      const ids = Object.keys(result!.manifest.endpoints)
      expect(ids).toContain('api-weather')
      expect(ids).toContain('api-data-sports')
    })

    it('falls back to endpoint-0, endpoint-1 for configs without resource URLs', () => {
      const config1 = makeEndpoint({ resource: undefined as any })
      const config2 = makeEndpoint({ resource: undefined as any })

      const result = normalizeWildManifest({ paymentEndpoints: [config1, config2] })

      expect(result).not.toBeNull()
      const ids = Object.keys(result!.manifest.endpoints)
      expect(ids).toContain('endpoint-0')
      expect(ids).toContain('endpoint-1')
    })

    it('handles URL-based ID collisions by appending -2, -3', () => {
      const config1 = makeEndpoint({ resource: { url: 'https://example.com/api' } })
      const config2 = makeEndpoint({ resource: { url: 'https://example.com/api' } })
      const config3 = makeEndpoint({ resource: { url: 'https://example.com/api' } })

      const result = normalizeWildManifest({ paymentEndpoints: [config1, config2, config3] })

      expect(result).not.toBeNull()
      const ids = Object.keys(result!.manifest.endpoints)
      expect(ids).toHaveLength(3)
      expect(ids).toContain('api')
      expect(ids).toContain('api-2')
      expect(ids).toContain('api-3')
    })

    it('produces WILD_MANIFEST_ARRAY_FORMAT warning', () => {
      const result = normalizeWildManifest({ paymentEndpoints: [makeEndpoint()] })

      expect(result!.warnings).toHaveLength(1)
      expect(result!.warnings[0]!.code).toBe('WILD_MANIFEST_ARRAY_FORMAT')
      expect(result!.warnings[0]!.severity).toBe('warning')
    })

    it('preserves financial data exactly (amounts, addresses unchanged)', () => {
      const config = makeEndpoint({
        accepts: [
          {
            scheme: 'exact',
            network: 'eip155:8453',
            amount: '1234567890123456789',
            asset: '0xAbCdEf1234567890aBcDeF1234567890AbCdEf12',
            payTo: '0x1234567890aBcDeF1234567890AbCdEf12345678',
          },
        ],
      })

      const result = normalizeWildManifest({ paymentEndpoints: [config] })

      expect(result).not.toBeNull()
      const endpoint = Object.values(result!.manifest.endpoints)[0]!
      expect(endpoint.accepts[0]!.amount).toBe('1234567890123456789')
      expect(endpoint.accepts[0]!.asset).toBe('0xAbCdEf1234567890aBcDeF1234567890AbCdEf12')
      expect(endpoint.accepts[0]!.payTo).toBe('0x1234567890aBcDeF1234567890AbCdEf12345678')
      expect(endpoint.accepts[0]!.network).toBe('eip155:8453')
    })
  })

  describe('nested-service-style normalization', () => {
    it('normalizes depth-1 nested structure to canonical shape', () => {
      const weather = makeEndpoint({ resource: { url: 'https://example.com/weather' } })
      const data = makeEndpoint({ resource: { url: 'https://example.com/data' } })

      const result = normalizeWildManifest({ weather, data })

      expect(result).not.toBeNull()
      expect(result!.manifest.endpoints.weather).toEqual(weather)
      expect(result!.manifest.endpoints.data).toEqual(data)
      expect(result!.warnings).toHaveLength(1)
      expect(result!.warnings[0]!.code).toBe('WILD_MANIFEST_NESTED_FORMAT')
    })

    it('normalizes depth-2 nested structure with grouping keys', () => {
      const apiConfig = {
        weather: makeEndpoint({ resource: { url: 'https://example.com/weather' } }),
        data: makeEndpoint({ resource: { url: 'https://example.com/data' } }),
      }

      const result = normalizeWildManifest({ api: apiConfig })

      expect(result).not.toBeNull()
      expect(result!.manifest.endpoints['api-weather']).toEqual(apiConfig.weather)
      expect(result!.manifest.endpoints['api-data']).toEqual(apiConfig.data)
      expect(result!.warnings[0]!.code).toBe('WILD_MANIFEST_NESTED_FORMAT')
    })

    it('produces WILD_MANIFEST_NESTED_FORMAT warning', () => {
      const result = normalizeWildManifest({ weather: makeEndpoint() })

      expect(result!.warnings).toHaveLength(1)
      expect(result!.warnings[0]!.code).toBe('WILD_MANIFEST_NESTED_FORMAT')
      expect(result!.warnings[0]!.field).toBe('endpoints')
    })
  })

  describe('service metadata extraction', () => {
    it('extracts service metadata from service object', () => {
      const result = normalizeWildManifest({
        service: {
          name: 'Weather API',
          description: 'Weather data provider',
          version: '1.0.0',
          url: 'https://weather.example.com',
          contact: {
            name: 'Support',
            email: 'support@example.com',
            url: 'https://example.com/support',
          },
        },
        paymentEndpoints: [makeEndpoint()],
      })

      expect(result).not.toBeNull()
      expect(result!.manifest.service).toEqual({
        name: 'Weather API',
        description: 'Weather data provider',
        version: '1.0.0',
        url: 'https://weather.example.com',
        contact: {
          name: 'Support',
          email: 'support@example.com',
          url: 'https://example.com/support',
        },
      })
    })

    it('promotes top-level name to service.name with warning', () => {
      const result = normalizeWildManifest({
        name: 'My API',
        paymentEndpoints: [makeEndpoint()],
      })

      expect(result).not.toBeNull()
      expect(result!.manifest.service?.name).toBe('My API')
      expect(result!.warnings.some((w) => w.code === 'WILD_MANIFEST_NAME_PROMOTED')).toBe(true)
    })

    it('extracts description and version from top level', () => {
      const result = normalizeWildManifest({
        description: 'Test service',
        version: '2.0.0',
        paymentEndpoints: [makeEndpoint()],
      })

      expect(result).not.toBeNull()
      expect(result!.manifest.service?.description).toBe('Test service')
      expect(result!.manifest.service?.version).toBe('2.0.0')
    })

    it('does not overwrite service.name with top-level name if service.name exists', () => {
      const result = normalizeWildManifest({
        name: 'Top-level name',
        service: {
          name: 'Service name',
        },
        paymentEndpoints: [makeEndpoint()],
      })

      expect(result).not.toBeNull()
      expect(result!.manifest.service?.name).toBe('Service name')
      expect(result!.warnings.some((w) => w.code === 'WILD_MANIFEST_NAME_PROMOTED')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('returns null for non-object input', () => {
      expect(normalizeWildManifest(null)).toBeNull()
      expect(normalizeWildManifest(undefined)).toBeNull()
      expect(normalizeWildManifest('string')).toBeNull()
      expect(normalizeWildManifest(42)).toBeNull()
      expect(normalizeWildManifest([makeEndpoint()])).toBeNull()
    })

    it('returns null for canonical manifest (already has endpoints Record)', () => {
      const canonical: ManifestConfig = {
        endpoints: {
          weather: makeEndpoint(),
        },
      }

      expect(normalizeWildManifest(canonical)).toBeNull()
    })

    it('returns null for object with no recognizable pattern', () => {
      expect(normalizeWildManifest({ foo: 'bar', baz: 123 })).toBeNull()
      expect(normalizeWildManifest({})).toBeNull()
    })

    it('preserves extensions from input', () => {
      const result = normalizeWildManifest({
        paymentEndpoints: [makeEndpoint()],
        extensions: {
          customField: 'custom value',
          anotherField: 42,
        },
      })

      expect(result).not.toBeNull()
      expect(result!.manifest.extensions).toEqual({
        customField: 'custom value',
        anotherField: 42,
      })
    })

    it('does not add undefined fields to service metadata', () => {
      const result = normalizeWildManifest({
        service: {
          name: 'Test',
          // no description, version, url, contact
        },
        paymentEndpoints: [makeEndpoint()],
      })

      expect(result).not.toBeNull()
      expect(result!.manifest.service).toEqual({ name: 'Test' })
      expect(result!.manifest.service).not.toHaveProperty('description')
      expect(result!.manifest.service).not.toHaveProperty('version')
    })
  })
})
