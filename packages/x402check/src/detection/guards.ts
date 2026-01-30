/**
 * Runtime type guards for config format detection
 */

import type { V2Config, V1Config } from '../types'

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

