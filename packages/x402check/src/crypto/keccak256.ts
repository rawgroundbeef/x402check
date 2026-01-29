/**
 * Keccak-256 hash function wrapper
 * Uses @noble/hashes for audited, tree-shakeable implementation
 */

import { keccak_256 } from '@noble/hashes/sha3.js'

/**
 * Compute Keccak-256 hash (NOT SHA-3)
 *
 * @param input - String or Uint8Array to hash
 * @returns Lowercase hex string (64 chars, no 0x prefix)
 */
export function keccak256(input: string | Uint8Array): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : input

  const hash = keccak_256(bytes)

  return Array.from(hash)
    .map((b: number) => b.toString(16).padStart(2, '0'))
    .join('')
}
