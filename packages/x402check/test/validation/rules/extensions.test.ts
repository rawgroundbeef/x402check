import { describe, test, expect } from 'vitest'
import { validateBazaar, validateOutputSchema, validateMissingSchema } from '../../../src/validation/rules/extensions'
import { validate } from '../../../src/validation/orchestrator'
import { ErrorCode } from '../../../src/types/errors'
import type { NormalizedConfig } from '../../../src/types/config'

function makeConfig(extensions?: Record<string, unknown>): NormalizedConfig {
  return {
    x402Version: 2,
    accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0xabc', payTo: '0xdef' }],
    resource: { url: 'https://example.com/api' },
    extensions,
  }
}

// ── validateBazaar ─────────────────────────────────────────────────────

describe('validateBazaar', () => {
  test('returns no issues when extensions is absent', () => {
    const issues = validateBazaar(makeConfig())
    expect(issues).toHaveLength(0)
  })

  test('returns no issues when extensions.bazaar is absent', () => {
    const issues = validateBazaar(makeConfig({ other: {} }))
    expect(issues).toHaveLength(0)
  })

  test('returns no issues for valid bazaar extension', () => {
    const issues = validateBazaar(
      makeConfig({
        bazaar: {
          info: {
            input: { type: 'application/json', method: 'POST' },
            output: { type: 'application/json' },
          },
          schema: { type: 'object', properties: { query: { type: 'string' } } },
        },
      }),
    )
    expect(issues).toHaveLength(0)
  })

  test('warns when bazaar is not an object', () => {
    const issues = validateBazaar(makeConfig({ bazaar: 'invalid' }))
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_BAZAAR_INFO)
    expect(issues[0]!.severity).toBe('warning')
  })

  test('warns when bazaar.info is missing', () => {
    const issues = validateBazaar(
      makeConfig({
        bazaar: { schema: { type: 'object' } },
      }),
    )
    const infoIssue = issues.find((i) => i.field === 'extensions.bazaar.info')
    expect(infoIssue).toBeDefined()
    expect(infoIssue!.code).toBe(ErrorCode.INVALID_BAZAAR_INFO)
  })

  test('warns when bazaar.info.input is missing type', () => {
    const issues = validateBazaar(
      makeConfig({
        bazaar: {
          info: {
            input: { method: 'POST' },
            output: { type: 'application/json' },
          },
          schema: { type: 'object' },
        },
      }),
    )
    const inputIssue = issues.find((i) => i.field === 'extensions.bazaar.info.input')
    expect(inputIssue).toBeDefined()
    expect(inputIssue!.code).toBe(ErrorCode.INVALID_BAZAAR_INFO_INPUT)
  })

  test('warns when bazaar.info.input is missing method', () => {
    const issues = validateBazaar(
      makeConfig({
        bazaar: {
          info: {
            input: { type: 'application/json' },
            output: { type: 'application/json' },
          },
          schema: { type: 'object' },
        },
      }),
    )
    const inputIssue = issues.find((i) => i.field === 'extensions.bazaar.info.input')
    expect(inputIssue).toBeDefined()
    expect(inputIssue!.code).toBe(ErrorCode.INVALID_BAZAAR_INFO_INPUT)
  })

  test('warns when bazaar.info.output is missing', () => {
    const issues = validateBazaar(
      makeConfig({
        bazaar: {
          info: {
            input: { type: 'application/json', method: 'POST' },
          },
          schema: { type: 'object' },
        },
      }),
    )
    const outputIssue = issues.find((i) => i.field === 'extensions.bazaar.info.output')
    expect(outputIssue).toBeDefined()
    expect(outputIssue!.code).toBe(ErrorCode.INVALID_BAZAAR_INFO)
  })

  test('warns when bazaar.schema is missing', () => {
    const issues = validateBazaar(
      makeConfig({
        bazaar: {
          info: {
            input: { type: 'application/json', method: 'POST' },
            output: { type: 'application/json' },
          },
        },
      }),
    )
    const schemaIssue = issues.find((i) => i.field === 'extensions.bazaar.schema')
    expect(schemaIssue).toBeDefined()
    expect(schemaIssue!.code).toBe(ErrorCode.INVALID_BAZAAR_SCHEMA)
  })

  test('warns when bazaar.schema has no recognizable JSON Schema keys', () => {
    const issues = validateBazaar(
      makeConfig({
        bazaar: {
          info: {
            input: { type: 'application/json', method: 'POST' },
            output: { type: 'application/json' },
          },
          schema: { foo: 'bar' },
        },
      }),
    )
    const schemaIssue = issues.find((i) => i.field === 'extensions.bazaar.schema')
    expect(schemaIssue).toBeDefined()
    expect(schemaIssue!.code).toBe(ErrorCode.INVALID_BAZAAR_SCHEMA)
  })

  test('accepts schema with $schema key', () => {
    const issues = validateBazaar(
      makeConfig({
        bazaar: {
          info: {
            input: { type: 'application/json', method: 'POST' },
            output: { type: 'application/json' },
          },
          schema: { $schema: 'https://json-schema.org/draft/2020-12/schema' },
        },
      }),
    )
    const schemaIssue = issues.find((i) => i.field === 'extensions.bazaar.schema')
    expect(schemaIssue).toBeUndefined()
  })

  test('accepts schema with properties key', () => {
    const issues = validateBazaar(
      makeConfig({
        bazaar: {
          info: {
            input: { type: 'application/json', method: 'POST' },
            output: { type: 'application/json' },
          },
          schema: { properties: { name: { type: 'string' } } },
        },
      }),
    )
    const schemaIssue = issues.find((i) => i.field === 'extensions.bazaar.schema')
    expect(schemaIssue).toBeUndefined()
  })

  test('all issues have severity warning', () => {
    const issues = validateBazaar(makeConfig({ bazaar: {} }))
    expect(issues.length).toBeGreaterThan(0)
    for (const issue of issues) {
      expect(issue.severity).toBe('warning')
    }
  })
})

// ── validateOutputSchema ──────────────────────────────────────────────

describe('validateOutputSchema', () => {
  test('returns no issues when accepts has no outputSchema', () => {
    const parsed = {
      x402Version: 2,
      accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0xabc', payTo: '0xdef' }],
    }
    const issues = validateOutputSchema(parsed)
    expect(issues).toHaveLength(0)
  })

  test('returns no issues when accepts is not an array', () => {
    const issues = validateOutputSchema({ accepts: 'invalid' })
    expect(issues).toHaveLength(0)
  })

  test('returns no issues for valid outputSchema', () => {
    const parsed = {
      x402Version: 1,
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          maxAmountRequired: '1000000',
          asset: '0xabc',
          payTo: '0xdef',
          outputSchema: {
            input: { type: 'application/json', method: 'POST' },
            output: { type: 'application/json' },
          },
        },
      ],
    }
    const issues = validateOutputSchema(parsed)
    expect(issues).toHaveLength(0)
  })

  test('warns when outputSchema is not an object', () => {
    const parsed = {
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:8453',
          amount: '1000000',
          asset: '0xabc',
          payTo: '0xdef',
          outputSchema: 'invalid',
        },
      ],
    }
    const issues = validateOutputSchema(parsed)
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.INVALID_OUTPUT_SCHEMA)
    expect(issues[0]!.field).toBe('accepts[0].outputSchema')
  })

  test('warns when outputSchema.input is missing', () => {
    const parsed = {
      accepts: [
        {
          scheme: 'exact',
          outputSchema: {
            output: { type: 'application/json' },
          },
        },
      ],
    }
    const issues = validateOutputSchema(parsed)
    const inputIssue = issues.find((i) => i.field === 'accepts[0].outputSchema.input')
    expect(inputIssue).toBeDefined()
    expect(inputIssue!.code).toBe(ErrorCode.INVALID_OUTPUT_SCHEMA_INPUT)
  })

  test('warns when outputSchema.input is missing method', () => {
    const parsed = {
      accepts: [
        {
          scheme: 'exact',
          outputSchema: {
            input: { type: 'application/json' },
            output: { type: 'application/json' },
          },
        },
      ],
    }
    const issues = validateOutputSchema(parsed)
    const inputIssue = issues.find((i) => i.field === 'accepts[0].outputSchema.input')
    expect(inputIssue).toBeDefined()
    expect(inputIssue!.code).toBe(ErrorCode.INVALID_OUTPUT_SCHEMA_INPUT)
  })

  test('warns when outputSchema.output is missing', () => {
    const parsed = {
      accepts: [
        {
          scheme: 'exact',
          outputSchema: {
            input: { type: 'application/json', method: 'POST' },
          },
        },
      ],
    }
    const issues = validateOutputSchema(parsed)
    const outputIssue = issues.find((i) => i.field === 'accepts[0].outputSchema.output')
    expect(outputIssue).toBeDefined()
    expect(outputIssue!.code).toBe(ErrorCode.INVALID_OUTPUT_SCHEMA)
  })

  test('validates multiple accepts entries independently', () => {
    const parsed = {
      accepts: [
        {
          scheme: 'exact',
          outputSchema: {
            input: { type: 'application/json', method: 'POST' },
            output: { type: 'application/json' },
          },
        },
        {
          scheme: 'exact',
          outputSchema: { input: { type: 'text/plain' } },
        },
      ],
    }
    const issues = validateOutputSchema(parsed)
    // Second entry should have warnings for missing method and missing output
    expect(issues.some((i) => i.field === 'accepts[1].outputSchema.input')).toBe(true)
    expect(issues.some((i) => i.field === 'accepts[1].outputSchema.output')).toBe(true)
    // First entry should have no issues
    expect(issues.some((i) => i.field.startsWith('accepts[0]'))).toBe(false)
  })

  test('all issues have severity warning', () => {
    const parsed = {
      accepts: [{ scheme: 'exact', outputSchema: 'bad' }],
    }
    const issues = validateOutputSchema(parsed)
    for (const issue of issues) {
      expect(issue.severity).toBe('warning')
    }
  })
})

// ── validateMissingSchema ──────────────────────────────────────────────

describe('validateMissingSchema', () => {
  test('warns when neither bazaar nor outputSchema is present', () => {
    const config = makeConfig()
    const parsed = { x402Version: 2, accepts: [{ scheme: 'exact' }] }
    const issues = validateMissingSchema(config, parsed)
    expect(issues).toHaveLength(1)
    expect(issues[0]!.code).toBe(ErrorCode.MISSING_INPUT_SCHEMA)
    expect(issues[0]!.severity).toBe('warning')
    expect(issues[0]!.fix).toContain('bazaar')
  })

  test('no warning when extensions.bazaar is present', () => {
    const config = makeConfig({ bazaar: {} })
    const parsed = { x402Version: 2, accepts: [{ scheme: 'exact' }] }
    const issues = validateMissingSchema(config, parsed)
    expect(issues).toHaveLength(0)
  })

  test('no warning when any accepts[].outputSchema is present', () => {
    const config = makeConfig()
    const parsed = {
      x402Version: 2,
      accepts: [{ scheme: 'exact', outputSchema: { input: {}, output: {} } }],
    }
    const issues = validateMissingSchema(config, parsed)
    expect(issues).toHaveLength(0)
  })

  test('no warning when accepts is not an array but bazaar is present', () => {
    const config = makeConfig({ bazaar: { info: {} } })
    const parsed = { x402Version: 2, accepts: 'invalid' }
    const issues = validateMissingSchema(config, parsed)
    expect(issues).toHaveLength(0)
  })
})

// ── Integration with validate() ─────────────────────────────────────────

describe('extensions integration', () => {
  test('valid config with bazaar extension produces valid result with no extension warnings', () => {
    const input = {
      x402Version: 2,
      accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0x1234567890123456789012345678901234567890' }],
      resource: { url: 'https://example.com/api' },
      extensions: {
        bazaar: {
          info: {
            input: { type: 'application/json', method: 'POST' },
            output: { type: 'application/json' },
          },
          schema: { type: 'object', properties: { query: { type: 'string' } } },
        },
      },
    }
    const result = validate(input)
    expect(result.valid).toBe(true)
    // Should not have bazaar-related warnings
    const bazaarWarnings = result.warnings.filter((w) =>
      [ErrorCode.INVALID_BAZAAR_INFO, ErrorCode.INVALID_BAZAAR_SCHEMA, ErrorCode.INVALID_BAZAAR_INFO_INPUT, ErrorCode.MISSING_INPUT_SCHEMA].includes(w.code),
    )
    expect(bazaarWarnings).toHaveLength(0)
  })

  test('config with malformed bazaar produces warnings but is still valid', () => {
    const input = {
      x402Version: 2,
      accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0x1234567890123456789012345678901234567890' }],
      resource: { url: 'https://example.com/api' },
      extensions: {
        bazaar: { info: {} },
      },
    }
    const result = validate(input)
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.code === ErrorCode.INVALID_BAZAAR_INFO_INPUT)).toBe(true)
    expect(result.warnings.some((w) => w.code === ErrorCode.INVALID_BAZAAR_SCHEMA)).toBe(true)
  })

  test('config with no schema at all produces MISSING_INPUT_SCHEMA warning', () => {
    const input = {
      x402Version: 2,
      accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0x1234567890123456789012345678901234567890' }],
      resource: { url: 'https://example.com/api' },
    }
    const result = validate(input)
    expect(result.valid).toBe(true)
    expect(result.warnings.some((w) => w.code === ErrorCode.MISSING_INPUT_SCHEMA)).toBe(true)
  })

  test('strict mode promotes extension warnings to errors', () => {
    const input = {
      x402Version: 2,
      accepts: [{ scheme: 'exact', network: 'eip155:8453', amount: '1000000', asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', payTo: '0x1234567890123456789012345678901234567890' }],
      resource: { url: 'https://example.com/api' },
    }
    const result = validate(input, { strict: true })
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === ErrorCode.MISSING_INPUT_SCHEMA)).toBe(true)
  })
})
