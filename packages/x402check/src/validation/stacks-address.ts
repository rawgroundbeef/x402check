/**
 * Stacks address validation (c32check encoding with network-aware version bytes)
 */

import { decodeC32Address } from '../crypto/c32check'
import { ErrorCode } from '../types/errors'
import type { ValidationIssue } from '../types/validation'

// Stacks addresses start with S followed by P, M, T, or N
// SP = mainnet P2PKH, SM = mainnet P2SH
// ST = testnet P2PKH, SN = testnet P2SH
const STACKS_ADDRESS_REGEX = /^S[PMTN]/i

// Version bytes for Stacks addresses
const MAINNET_P2PKH = 22 // SP prefix
const MAINNET_P2SH = 20 // SM prefix
const TESTNET_P2PKH = 26 // ST prefix
const TESTNET_P2SH = 21 // SN prefix

/**
 * Validate a Stacks address (c32check encoded with version byte)
 *
 * Checks c32check encoding, validates checksum, and verifies version byte matches network
 *
 * @param address - Address to validate (may include .contract-name suffix)
 * @param network - CAIP-2 network identifier (stacks:1 or stacks:2147483648)
 * @param field - Field path for error reporting
 * @returns Array of validation issues (empty if valid)
 */
export function validateStacksAddress(
  address: string,
  network: string,
  field: string
): ValidationIssue[] {
  // Strip contract name suffix if present (e.g., SP123.my-contract -> SP123)
  const baseAddress = address.includes('.')
    ? address.split('.')[0] ?? address
    : address

  // Quick format check - must start with S followed by P, M, T, or N
  if (!STACKS_ADDRESS_REGEX.test(baseAddress)) {
    return [
      {
        code: ErrorCode.INVALID_STACKS_ADDRESS,
        field,
        message: 'Invalid Stacks address format',
        severity: 'error',
        fix: 'Stacks addresses start with SP, SM, ST, or SN',
      },
    ]
  }

  // Attempt to decode and verify checksum
  let version: number
  try {
    ;[version] = decodeC32Address(baseAddress)
  } catch (error) {
    return [
      {
        code: ErrorCode.INVALID_STACKS_ADDRESS,
        field,
        message: 'Invalid Stacks address checksum. Double-check the address for typos.',
        severity: 'error',
      },
    ]
  }

  // Extract CAIP-2 reference (network ID)
  const colonIndex = network.indexOf(':')
  const networkRef = colonIndex > 0 ? network.substring(colonIndex + 1) : ''

  // Validate version byte matches network
  if (networkRef === '1') {
    // Mainnet: expect SP (22) or SM (20)
    if (version !== MAINNET_P2PKH && version !== MAINNET_P2SH) {
      return [
        {
          code: ErrorCode.STACKS_NETWORK_MISMATCH,
          field,
          message: `This is a Stacks testnet address but the network is set to mainnet (stacks:1)`,
          severity: 'error',
          fix: 'Use stacks:2147483648 for testnet addresses, or use a mainnet address (SP/SM prefix)',
        },
      ]
    }
  } else if (networkRef === '2147483648') {
    // Testnet: expect ST (26) or SN (21)
    if (version !== TESTNET_P2PKH && version !== TESTNET_P2SH) {
      return [
        {
          code: ErrorCode.STACKS_NETWORK_MISMATCH,
          field,
          message: `This is a Stacks mainnet address but the network is set to testnet (stacks:2147483648)`,
          severity: 'error',
          fix: 'Use stacks:1 for mainnet addresses, or use a testnet address (ST/SN prefix)',
        },
      ]
    }
  } else {
    // Unknown network - shouldn't happen if registry is correct
    // But handle gracefully
    if (
      version !== MAINNET_P2PKH &&
      version !== MAINNET_P2SH &&
      version !== TESTNET_P2PKH &&
      version !== TESTNET_P2SH
    ) {
      return [
        {
          code: ErrorCode.INVALID_STACKS_ADDRESS,
          field,
          message: 'Unrecognized Stacks address version',
          severity: 'error',
        },
      ]
    }
  }

  // Valid Stacks address
  return []
}
