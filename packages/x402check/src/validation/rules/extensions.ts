/**
 * Level 6: Extensions validation
 * Validates extensions.bazaar (V2 Bazaar) and accepts[].outputSchema (V1 legacy)
 * All issues are warnings -- schemas improve discoverability but aren't required for payment flow
 */

import type { NormalizedConfig, ValidationIssue } from '../../types'
import { ErrorCode, ErrorMessages } from '../../types/errors'

/**
 * Check whether a value is a non-null plain object (not an array).
 */
function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Validate `extensions.bazaar` when present.
 *
 * Checks:
 * - bazaar is an object
 * - bazaar.info exists and is an object with input (type + method) and output
 * - bazaar.schema exists and looks like a JSON Schema object
 *
 * @returns Array of warning issues (empty when bazaar is absent or valid)
 */
export function validateBazaar(config: NormalizedConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!config.extensions) return issues

  const bazaar = config.extensions['bazaar']
  if (bazaar === undefined) return issues

  if (!isObject(bazaar)) {
    issues.push({
      code: ErrorCode.INVALID_BAZAAR_INFO,
      field: 'extensions.bazaar',
      message: 'extensions.bazaar must be an object',
      severity: 'warning',
      fix: 'Set extensions.bazaar to an object with info and schema properties',
    })
    return issues
  }

  // ── info ──────────────────────────────────────────────────────────────
  const info = bazaar['info']
  if (!isObject(info)) {
    issues.push({
      code: ErrorCode.INVALID_BAZAAR_INFO,
      field: 'extensions.bazaar.info',
      message: ErrorMessages.INVALID_BAZAAR_INFO,
      severity: 'warning',
      fix: 'Add an info object with input and output properties describing your API',
    })
  } else {
    const input = info['input']
    if (!isObject(input) || !input['type'] || !input['method']) {
      issues.push({
        code: ErrorCode.INVALID_BAZAAR_INFO_INPUT,
        field: 'extensions.bazaar.info.input',
        message: ErrorMessages.INVALID_BAZAAR_INFO_INPUT,
        severity: 'warning',
        fix: 'Add input.type (e.g. "application/json") and input.method (e.g. "POST")',
      })
    }

    const output = info['output']
    if (!isObject(output)) {
      issues.push({
        code: ErrorCode.INVALID_BAZAAR_INFO,
        field: 'extensions.bazaar.info.output',
        message: 'extensions.bazaar.info.output must be an object',
        severity: 'warning',
        fix: 'Add an output object describing the API response format',
      })
    }
  }

  // ── schema ────────────────────────────────────────────────────────────
  const schema = bazaar['schema']
  if (!isObject(schema) || (!schema['type'] && !schema['$schema'] && !schema['properties'])) {
    issues.push({
      code: ErrorCode.INVALID_BAZAAR_SCHEMA,
      field: 'extensions.bazaar.schema',
      message: ErrorMessages.INVALID_BAZAAR_SCHEMA,
      severity: 'warning',
      fix: 'Add a JSON Schema object with type, $schema, or properties',
    })
  }

  return issues
}

/**
 * Validate `accepts[].outputSchema` on the raw parsed input.
 *
 * Uses the raw parsed object because AcceptsEntry strips outputSchema during normalization.
 *
 * Checks per entry with outputSchema:
 * - outputSchema is an object
 * - outputSchema.input exists with type and method
 * - outputSchema.output exists and is an object
 *
 * @returns Array of warning issues
 */
export function validateOutputSchema(parsed: object): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const obj = parsed as Record<string, unknown>
  const accepts = obj['accepts']
  if (!Array.isArray(accepts)) return issues

  for (let i = 0; i < accepts.length; i++) {
    const entry = accepts[i]
    if (!isObject(entry)) continue

    const outputSchema = entry['outputSchema']
    if (outputSchema === undefined) continue

    const fieldPath = `accepts[${i}].outputSchema`

    if (!isObject(outputSchema)) {
      issues.push({
        code: ErrorCode.INVALID_OUTPUT_SCHEMA,
        field: fieldPath,
        message: ErrorMessages.INVALID_OUTPUT_SCHEMA,
        severity: 'warning',
        fix: 'Set outputSchema to an object with input and output properties',
      })
      continue
    }

    const input = outputSchema['input']
    if (!isObject(input) || !input['type'] || !input['method']) {
      issues.push({
        code: ErrorCode.INVALID_OUTPUT_SCHEMA_INPUT,
        field: `${fieldPath}.input`,
        message: ErrorMessages.INVALID_OUTPUT_SCHEMA_INPUT,
        severity: 'warning',
        fix: 'Add input.type (e.g. "application/json") and input.method (e.g. "POST")',
      })
    }

    const output = outputSchema['output']
    if (!isObject(output)) {
      issues.push({
        code: ErrorCode.INVALID_OUTPUT_SCHEMA,
        field: `${fieldPath}.output`,
        message: 'accepts[i].outputSchema.output must be an object',
        severity: 'warning',
        fix: 'Add an output object describing the API response format',
      })
    }
  }

  return issues
}

/**
 * Emit a warning when neither `extensions.bazaar` nor any `accepts[].outputSchema` is present.
 *
 * @returns Single-element array with MISSING_INPUT_SCHEMA warning, or empty array
 */
export function validateMissingSchema(config: NormalizedConfig, parsed: object): ValidationIssue[] {
  // Check for extensions.bazaar
  if (config.extensions && config.extensions['bazaar'] !== undefined) {
    return []
  }

  // Check for any accepts[].outputSchema in raw parsed input
  const obj = parsed as Record<string, unknown>
  const accepts = obj['accepts']
  if (Array.isArray(accepts)) {
    for (const entry of accepts) {
      if (isObject(entry) && entry['outputSchema'] !== undefined) {
        return []
      }
    }
  }

  return [
    {
      code: ErrorCode.MISSING_INPUT_SCHEMA,
      field: 'extensions',
      message: ErrorMessages.MISSING_INPUT_SCHEMA,
      severity: 'warning',
      fix: 'Add extensions.bazaar with info and schema to help agents discover your API -- see https://bazaar.x402.org',
    },
  ]
}
