/**
 * EIP-55 mixed-case checksum address encoding
 * Spec: https://eips.ethereum.org/EIPS/eip-55
 */

import { keccak256 } from './keccak256'

/**
 * Convert an Ethereum address to EIP-55 checksummed format
 *
 * @param address - 42-character hex address (0x-prefixed)
 * @returns Checksummed address with mixed case
 */
export function toChecksumAddress(address: string): string {
  // Lowercase the hex part (strip 0x prefix)
  const lowerHex = address.slice(2).toLowerCase()

  // Hash the lowercase hex
  const hash = keccak256(lowerHex)

  // Build checksummed version
  let result = '0x'
  for (let i = 0; i < lowerHex.length; i++) {
    const char = lowerHex[i]
    const hashChar = hash[i]
    if (!char || !hashChar) continue // Should never happen with valid 40-char hex

    if (char >= 'a' && char <= 'f') {
      // For hex letters, uppercase if hash nibble >= 8
      const hashNibble = parseInt(hashChar, 16)
      result += hashNibble >= 8 ? char.toUpperCase() : char
    } else {
      // For digits, keep as-is
      result += char
    }
  }

  return result
}

/**
 * Check if an address has valid EIP-55 checksum
 *
 * Returns false for all-lowercase or all-uppercase addresses
 * (these are valid formats but do not match their checksummed version)
 *
 * @param address - Address to validate
 * @returns True if checksum is valid
 */
export function isValidChecksum(address: string): boolean {
  return address === toChecksumAddress(address)
}
