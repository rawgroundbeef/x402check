/**
 * Level 5: Legacy format validation
 * Produces warnings for legacy config formats with upgrade suggestions
 */

import type { NormalizedConfig, ConfigFormat, ValidationIssue } from '../../types'
import { ErrorCode, ErrorMessages } from '../../types/errors'

/**
 * Validate for legacy format usage and produce upgrade suggestions.
 *
 * @param _config - Normalized config (reserved for future use)
 * @param detectedFormat - Detected config format
 * @param _originalInput - Original input object (reserved for future use)
 * @returns Array of validation issues (warnings)
 */
export function validateLegacy(
  _config: NormalizedConfig,
  detectedFormat: ConfigFormat,
  _originalInput: object,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (detectedFormat === 'v1') {
    issues.push({
      code: ErrorCode.LEGACY_FORMAT,
      field: '$',
      message: ErrorMessages.LEGACY_FORMAT,
      severity: 'warning',
      fix: 'Upgrade to x402 v2 -- use amount instead of maxAmountRequired, add resource object',
    })
  }

  return issues
}
