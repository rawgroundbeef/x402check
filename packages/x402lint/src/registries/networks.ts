// Network registry and CAIP-2 validation
// REG-01: Known CAIP-2 network registry
// REG-02: Format validation and registry lookup

export type NetworkType = 'evm' | 'solana' | 'stellar' | 'aptos' | 'stacks'

export interface NetworkInfo {
  name: string
  type: NetworkType
  testnet: boolean
}

// CAIP-2 format: namespace:reference
// Namespace: 3-8 lowercase alphanumeric + hyphens
// Reference: 1-32 alphanumeric + hyphens + underscores
export const CAIP2_REGEX = /^[-a-z0-9]{3,8}:[-_a-zA-Z0-9]{1,32}$/

// Known networks registry - extensible by adding entries
export const KNOWN_NETWORKS = {
  // EVM networks
  'eip155:8453': { name: 'Base', type: 'evm', testnet: false },
  'eip155:84532': { name: 'Base Sepolia', type: 'evm', testnet: true },
  'eip155:43114': { name: 'Avalanche C-Chain', type: 'evm', testnet: false },
  'eip155:43113': { name: 'Avalanche Fuji', type: 'evm', testnet: true },
  'eip155:723487': { name: 'Radius Network', type: 'evm', testnet: false },
  'eip155:72344': { name: 'Radius Testnet', type: 'evm', testnet: true },

  // Solana networks
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
    name: 'Solana',
    type: 'solana',
    testnet: false,
  },
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': {
    name: 'Solana Devnet',
    type: 'solana',
    testnet: true,
  },
  'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z': {
    name: 'Solana Testnet',
    type: 'solana',
    testnet: true,
  },

  // Stacks networks
  'stacks:1': { name: 'Stacks', type: 'stacks', testnet: false },
  'stacks:2147483648': { name: 'Stacks Testnet', type: 'stacks', testnet: true },

  // Stellar networks
  'stellar:pubnet': { name: 'Stellar', type: 'stellar', testnet: false },
  'stellar:testnet': { name: 'Stellar Testnet', type: 'stellar', testnet: true },

  // Aptos networks (community convention, not official CAIP)
  'aptos:1': { name: 'Aptos', type: 'aptos', testnet: false },
  'aptos:2': { name: 'Aptos Testnet', type: 'aptos', testnet: true },
} as const satisfies Record<string, NetworkInfo>

// Validate CAIP-2 format (doesn't check registry)
export function isValidCaip2(value: string): boolean {
  return CAIP2_REGEX.test(value)
}

// Check if network exists in registry
export function isKnownNetwork(caip2: string): boolean {
  return caip2 in KNOWN_NETWORKS
}

// Get network info from registry
export function getNetworkInfo(caip2: string): NetworkInfo | undefined {
  return KNOWN_NETWORKS[caip2 as keyof typeof KNOWN_NETWORKS]
}

// Extract namespace from CAIP-2 identifier (e.g., "eip155" from "eip155:8453")
export function getNetworkNamespace(caip2: string): string | undefined {
  if (!isValidCaip2(caip2)) {
    return undefined
  }
  const colonIndex = caip2.indexOf(':')
  return colonIndex > 0 ? caip2.substring(0, colonIndex) : undefined
}
