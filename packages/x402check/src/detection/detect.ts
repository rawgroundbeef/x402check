/**
 * Format detection function
 * API-02: Detect config format from input
 */

import type { ConfigFormat } from '../types'
import { parseInput } from '../types'
import { isV2Config, isV1Config } from './guards'

/**
 * Detect the format of an x402 config
 *
 * @param input - JSON string or parsed object
 * @returns ConfigFormat literal: 'v2' | 'v1' | 'unknown'
 *
 * Detection requires x402Version field:
 * 1. v2: accepts array + x402Version: 2
 * 2. v1: accepts array + x402Version: 1
 * 3. unknown: anything else (including versionless configs)
 */
export function detect(input: string | object): ConfigFormat {
  const { parsed, error } = parseInput(input)

  if (error) return 'unknown'

  if (isV2Config(parsed)) return 'v2'
  if (isV1Config(parsed)) return 'v1'

  return 'unknown'
}
