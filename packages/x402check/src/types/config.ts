/**
 * Type definitions for all x402 config formats
 */

/**
 * Config format discriminator
 */
export type ConfigFormat = 'v2' | 'v1' | 'unknown'

/**
 * HTTP resource definition
 */
export interface Resource {
  url: string
  method?: string | undefined
  headers?: Record<string, string> | undefined
  body?: string | undefined
}

/**
 * V2 accepts array entry
 */
export interface AcceptsEntry {
  scheme: string
  network: string
  amount: string
  asset: string
  payTo: string
  maxTimeoutSeconds?: number | undefined
  extra?: Record<string, unknown> | undefined
}

/**
 * x402 v2 config shape
 */
export interface V2Config {
  x402Version: 2
  accepts: AcceptsEntry[]
  resource: Resource
  error?: string | undefined
  extensions?: Record<string, unknown> | undefined
}

/**
 * V1 accepts array entry (different field names from v2)
 */
export interface V1AcceptsEntry {
  scheme: string
  network: string
  maxAmountRequired: string
  asset: string
  payTo: string
  maxTimeoutSeconds?: number | undefined
  extra?: Record<string, unknown> | undefined
  resource?: Resource | undefined
}

/**
 * x402 v1 config shape
 */
export interface V1Config {
  x402Version: 1
  accepts: V1AcceptsEntry[]
  error?: string | undefined
  extensions?: Record<string, unknown> | undefined
}

/**
 * Normalized config output (canonical v2 shape)
 */
export interface NormalizedConfig {
  x402Version: 2
  accepts: AcceptsEntry[]
  resource?: Resource | undefined
  error?: string | undefined
  extensions?: Record<string, unknown> | undefined
}
