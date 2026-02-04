/**
 * Address validation with CAIP-2 namespace dispatch
 *
 * Dispatches to chain-specific validators based on network namespace
 */

import { getNetworkNamespace } from '../registries/networks'
import { validateEvmAddress } from './evm-address'
import { validateSolanaAddress } from './solana-address'
import { validateStacksAddress } from './stacks-address'
import type { ValidationIssue } from '../types/validation'

/**
 * Validate an address for a specific network
 *
 * Dispatches to appropriate chain-specific validator based on CAIP-2 namespace:
 * - eip155:* → EVM address validation
 * - solana:* → Solana address validation
 * - stellar:*, aptos:* → Accept any string (deep validation deferred)
 * - Unknown namespaces → Accept any string (registry warnings handled elsewhere)
 *
 * Cross-chain mismatches are caught naturally by dispatch:
 * - EVM address (0x...) on Solana network → fails Solana Base58 validation
 * - Solana address on EVM network → fails EVM 0x-prefix validation
 *
 * @param address - Address to validate
 * @param network - CAIP-2 network identifier
 * @param field - Field path for error reporting
 * @returns Array of validation issues (empty if valid)
 */
export function validateAddress(
  address: string,
  network: string,
  field: string
): ValidationIssue[] {
  const namespace = getNetworkNamespace(network)

  // Invalid CAIP-2 format - network errors handled elsewhere
  if (namespace === undefined) {
    return []
  }

  // Dispatch by namespace
  switch (namespace) {
    case 'eip155':
      return validateEvmAddress(address, field)

    case 'solana':
      return validateSolanaAddress(address, field)

    case 'stacks':
      return validateStacksAddress(address, network, field)

    case 'stellar':
    case 'aptos':
      // Accept any address - deep validation deferred to future phases
      return []

    default:
      // Unknown namespace - warnings handled by registry validation
      return []
  }
}
