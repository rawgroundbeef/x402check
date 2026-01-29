/**
 * Base58 decoder wrapper
 * Uses @scure/base for audited, tree-shakeable implementation
 */

import { base58 } from '@scure/base'

/**
 * Decode a Base58-encoded string to bytes
 *
 * Preserves leading zero bytes (represented as leading '1' characters)
 *
 * @param input - Base58 string
 * @returns Decoded bytes
 * @throws Error if input contains invalid Base58 characters
 */
export function decodeBase58(input: string): Uint8Array {
  try {
    return base58.decode(input)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid Base58: ${message}`)
  }
}
