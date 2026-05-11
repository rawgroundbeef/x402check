// Asset registry for known tokens per network
// REG-04: Known asset mapping
// REG-05: Unknown asset handling

import { getNetworkNamespace } from './networks'

export interface AssetInfo {
  symbol: string
  name: string
  decimals: number
}

// Known assets by network and address
// EVM addresses stored in lowercase for case-insensitive lookup
export const KNOWN_ASSETS = {
  // Base (eip155:8453)
  'eip155:8453': {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
  },

  // Base Sepolia (eip155:84532)
  'eip155:84532': {
    '0x036cbd53842c5426634e7929541ec2318f3dcf7e': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
  },

  // Avalanche C-Chain (eip155:43114)
  'eip155:43114': {
    '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e': {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
  },

  // Radius Network (eip155:723487)
  'eip155:723487': {
    '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb': {
      symbol: 'SBC',
      name: 'Stable Coin',
      decimals: 6,
    },
  },

  // Radius Testnet (eip155:72344)
  'eip155:72344': {
    '0x33ad9e4bd16b69b5bfded37d8b5d9ff9aba014fb': {
      symbol: 'SBC',
      name: 'Stable Coin',
      decimals: 6,
    },
  },

  // Solana Mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp)
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': {
    EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {
      symbol: 'USDC',
      name: 'USD Coin',
      decimals: 6,
    },
  },
} as const satisfies Record<string, Record<string, AssetInfo>>

// Check if asset exists in registry
export function isKnownAsset(network: string, address: string): boolean {
  const networkAssets = KNOWN_ASSETS[network as keyof typeof KNOWN_ASSETS]
  if (!networkAssets) {
    return false
  }

  // Use lowercase comparison for EVM networks
  const namespace = getNetworkNamespace(network)
  const lookupAddress = namespace === 'eip155' ? address.toLowerCase() : address

  return lookupAddress in networkAssets
}

// Get asset info from registry
export function getAssetInfo(network: string, address: string): AssetInfo | undefined {
  const networkAssets = KNOWN_ASSETS[network as keyof typeof KNOWN_ASSETS]
  if (!networkAssets) {
    return undefined
  }

  // Use lowercase comparison for EVM networks
  const namespace = getNetworkNamespace(network)
  const lookupAddress = namespace === 'eip155' ? address.toLowerCase() : address

  return networkAssets[lookupAddress as keyof typeof networkAssets]
}
