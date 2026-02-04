/**
 * Runtime type guards for config format detection
 */

import type { V2Config, V1Config, ManifestConfig } from '../types'

/**
 * Check if value is a non-null, non-array object
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Check if config has an accepts array
 */
export function hasAcceptsArray(config: Record<string, unknown>): boolean {
  return 'accepts' in config && Array.isArray(config.accepts)
}

/**
 * Type guard for v2 config
 * Checks for accepts array + x402Version: 2
 * Note: resource is required by spec but its absence is a validation error, not a detection failure
 */
export function isV2Config(value: unknown): value is V2Config {
  if (!isRecord(value)) return false
  if (!hasAcceptsArray(value)) return false
  return 'x402Version' in value && value.x402Version === 2
}

/**
 * Type guard for v1 config
 * Checks for accepts array + x402Version: 1
 */
export function isV1Config(value: unknown): value is V1Config {
  if (!isRecord(value)) return false
  if (!hasAcceptsArray(value)) return false
  return 'x402Version' in value && value.x402Version === 1
}

/**
 * Type guard for manifest config (collection of v2 endpoints)
 * Checks for endpoints collection structure only -- deep validation happens in validateManifest()
 * MUST be checked before isV2Config() since manifests may have x402Version: 2
 */
export function isManifestConfig(value: unknown): value is ManifestConfig {
  if (!isRecord(value)) return false
  if (!('endpoints' in value)) return false
  if (!isRecord(value.endpoints)) return false

  // Verify endpoint values look like v2 configs (structural, not deep)
  // Empty endpoints ({}) is valid -- allows manifest initialization
  const endpoints = value.endpoints as Record<string, unknown>
  for (const key in endpoints) {
    const endpoint = endpoints[key]
    if (!isRecord(endpoint)) return false
    if (!hasAcceptsArray(endpoint)) return false
  }

  return true
}

