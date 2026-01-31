/**
 * Validation orchestrator
 * Composes all rule modules into a single validation pipeline
 *
 * Pipeline: parse -> detect -> normalize -> validate rules -> collect issues -> strict mode
 */

import type { ValidationResult, ValidationIssue } from '../types/validation'
import type { NormalizedConfig } from '../types/config'
import { ErrorCode, ErrorMessages } from '../types/errors'
import { normalize } from '../detection/normalize'
import { validateAddress } from './address'
import {
  validateStructure,
  validateVersion,
  validateFields,
  validateAccepts,
  validateResource,
  validateNetwork,
  validateAsset,
  validateAmount,
  validateTimeout,
  validateLegacy,
  validateBazaar,
  validateOutputSchema,
  validateMissingSchema,
} from './rules'

/**
 * Options for the validate() orchestrator
 */
export interface ValidationOptions {
  /** When true, all warnings are promoted to errors */
  strict?: boolean | undefined
}

/**
 * Validate an x402 config through the full pipeline.
 *
 * Takes any input (JSON string or object), runs it through:
 * 1. Structure validation (parse, object check, format detection)
 * 2. Normalization to canonical v2 shape
 * 3. Version, accepts, resource validation
 * 4. Per-entry field, network, asset, amount, timeout, address validation
 * 5. Legacy format warnings
 * 6. Strict mode promotion (warnings -> errors)
 *
 * NEVER throws -- all invalid inputs produce structured error results.
 *
 * @param input - JSON string or parsed object to validate
 * @param options - Validation options (e.g. strict mode)
 * @returns Structured validation result
 */
export function validate(
  input: string | object,
  options?: ValidationOptions | undefined,
): ValidationResult {
  try {
    return runPipeline(input, options)
  } catch {
    // Safety net: validate() must never throw
    return {
      valid: false,
      version: 'unknown',
      errors: [
        {
          code: ErrorCode.UNKNOWN_FORMAT,
          field: '$',
          message: 'Unexpected validation error',
          severity: 'error',
        },
      ],
      warnings: [],
      normalized: null,
    }
  }
}

/**
 * Internal pipeline implementation.
 * Separated from validate() so the try/catch safety net is clean.
 */
function runPipeline(
  input: string | object,
  options: ValidationOptions | undefined,
): ValidationResult {
  // ── Level 1: Structure ──────────────────────────────────────────────
  const structure = validateStructure(input)

  if (structure.issues.length > 0) {
    return {
      valid: false,
      version: structure.format || 'unknown',
      errors: structure.issues,
      warnings: [],
      normalized: null,
    }
  }

  const parsed = structure.parsed as object
  const format = structure.format

  // ── Normalize ───────────────────────────────────────────────────────
  const normalized: NormalizedConfig | null = normalize(parsed)

  if (normalized === null) {
    return {
      valid: false,
      version: format,
      errors: [
        {
          code: ErrorCode.UNKNOWN_FORMAT,
          field: '$',
          message: ErrorMessages.UNKNOWN_FORMAT,
          severity: 'error',
        },
      ],
      warnings: [],
      normalized: null,
    }
  }

  // ── Collect Issues ──────────────────────────────────────────────────
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []

  // ── Level 2: Version ────────────────────────────────────────────────
  errors.push(...validateVersion(normalized, format))

  // ── Level 2: Accepts ────────────────────────────────────────────────
  errors.push(...validateAccepts(normalized))

  // ── Level 2: Resource ───────────────────────────────────────────────
  warnings.push(...validateResource(normalized, format))

  // ── Levels 3-4: Per-entry validation ────────────────────────────────
  if (Array.isArray(normalized.accepts) && normalized.accepts.length > 0) {
    for (let i = 0; i < normalized.accepts.length; i++) {
      const entry = normalized.accepts[i]!
      const fieldPath = `accepts[${i}]`

      // Fields (errors)
      errors.push(...validateFields(entry, fieldPath))

      // Network (mixed: errors and warnings by severity)
      for (const issue of validateNetwork(entry, fieldPath)) {
        if (issue.severity === 'error') {
          errors.push(issue)
        } else {
          warnings.push(issue)
        }
      }

      // Asset (warnings)
      warnings.push(...validateAsset(entry, fieldPath))

      // Amount (errors)
      errors.push(...validateAmount(entry, fieldPath))

      // Timeout (mixed: errors and warnings by severity)
      for (const issue of validateTimeout(entry, fieldPath, format)) {
        if (issue.severity === 'error') {
          errors.push(issue)
        } else {
          warnings.push(issue)
        }
      }

      // Address validation (dispatch by severity)
      if (entry.payTo && entry.network) {
        for (const issue of validateAddress(entry.payTo, entry.network, `${fieldPath}.payTo`)) {
          if (issue.severity === 'error') {
            errors.push(issue)
          } else {
            warnings.push(issue)
          }
        }
      }
    }
  }

  // ── Level 5: Legacy ─────────────────────────────────────────────────
  warnings.push(...validateLegacy(normalized, format, parsed))

  // ── Level 6: Extensions ────────────────────────────────────────────
  warnings.push(...validateBazaar(normalized))
  warnings.push(...validateOutputSchema(parsed))
  warnings.push(...validateMissingSchema(normalized, parsed))

  // ── Strict Mode ─────────────────────────────────────────────────────
  if (options?.strict === true) {
    for (const warning of warnings) {
      errors.push({ ...warning, severity: 'error' })
    }
    warnings.length = 0
  }

  // ── Return ──────────────────────────────────────────────────────────
  return {
    valid: errors.length === 0,
    version: format,
    errors,
    warnings,
    normalized,
  }
}
