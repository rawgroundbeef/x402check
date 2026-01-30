/**
 * Config normalization pipeline
 * API-03: Transform any config format to canonical v2 shape
 */

import type {
  NormalizedConfig,
  AcceptsEntry,
  ConfigFormat,
  V2Config,
  V1Config,
} from '../types'
import { parseInput } from '../types'
import { detect } from './detect'

/**
 * Normalize any x402 config format to canonical v2 shape
 *
 * @param input - JSON string or parsed object
 * @returns NormalizedConfig or null if format is unknown/invalid
 *
 * Normalization rules:
 * - v2: Pass through with new object (FMT-07)
 * - v1: Map maxAmountRequired → amount, lift per-entry resource (FMT-06)
 * - unknown: Return null
 *
 * All transformations preserve extensions and extra fields (FMT-08)
 */
export function normalize(input: string | object): NormalizedConfig | null {
  const { parsed, error } = parseInput(input)
  if (error) return null

  const format = detect(parsed as object)

  switch (format) {
    case 'v2':
      return normalizeV2(parsed as V2Config)
    case 'v1':
      return normalizeV1ToV2(parsed as V1Config)
    case 'unknown':
      return null
    default: {
      const _exhaustive: never = format
      return _exhaustive
    }
  }
}

/**
 * Normalize v2 config (pass-through with new object)
 * FMT-07: v2 configs are already canonical, just create new object
 */
function normalizeV2(config: V2Config): NormalizedConfig {
  const result: NormalizedConfig = {
    x402Version: 2,
    accepts: [...config.accepts],
    resource: config.resource,
  }

  if (config.error !== undefined) {
    result.error = config.error
  }

  if (config.extensions !== undefined) {
    result.extensions = config.extensions
  }

  return result
}

/**
 * Normalize v1 config to v2
 * FMT-06: Map maxAmountRequired → amount, lift per-entry resource to top level
 */
function normalizeV1ToV2(config: V1Config): NormalizedConfig {
  let topLevelResource: NormalizedConfig['resource'] = undefined

  const mappedAccepts: AcceptsEntry[] = config.accepts.map((entry) => {
    // Lift first resource to top level
    if (entry.resource && !topLevelResource) {
      topLevelResource = entry.resource
    }

    const mapped: AcceptsEntry = {
      scheme: entry.scheme,
      network: entry.network,
      amount: entry.maxAmountRequired,
      asset: entry.asset,
      payTo: entry.payTo,
    }

    if (entry.maxTimeoutSeconds !== undefined) {
      mapped.maxTimeoutSeconds = entry.maxTimeoutSeconds
    }

    if (entry.extra !== undefined) {
      mapped.extra = entry.extra
    }

    return mapped
  })

  const result: NormalizedConfig = {
    x402Version: 2,
    accepts: mappedAccepts,
  }

  if (topLevelResource !== undefined) {
    result.resource = topLevelResource
  }

  if (config.error !== undefined) {
    result.error = config.error
  }

  if (config.extensions !== undefined) {
    result.extensions = config.extensions
  }

  return result
}

