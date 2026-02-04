/**
 * Type definitions for x402 manifest configs (collections of endpoints)
 */

import type { V2Config } from './config'
import type { ValidationIssue, ValidationResult } from './validation'

/**
 * Optional contact information for service
 */
export interface ServiceContact {
  name?: string
  email?: string
  url?: string
}

/**
 * Optional service-level metadata
 */
export interface ServiceMetadata {
  name?: string
  description?: string
  version?: string
  url?: string
  contact?: ServiceContact
}

/**
 * Manifest config shape (collection of v2 endpoints)
 * Canonical format for multi-endpoint x402 configurations
 */
export interface ManifestConfig {
  x402Version?: 2 // optional at manifest level
  service?: ServiceMetadata
  endpoints: Record<string, V2Config> // keyed by endpoint ID
  extensions?: Record<string, unknown>
}

/**
 * Manifest validation result (for Phase 13)
 * Includes both manifest-level issues and per-endpoint validation results
 */
export interface ManifestValidationResult {
  valid: boolean
  errors: ValidationIssue[] // manifest-level errors
  warnings: ValidationIssue[] // manifest-level warnings
  endpointResults: Record<string, ValidationResult> // per-endpoint results
  normalized: ManifestConfig // normalized manifest for caller convenience
}
