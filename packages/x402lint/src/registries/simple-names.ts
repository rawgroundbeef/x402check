// Legacy chain name to CAIP-2 mapping
// REG-03: Simple name conversion for fix suggestions and normalization

// Maps lowercase simple names to canonical CAIP-2 identifiers
export const SIMPLE_NAME_TO_CAIP2 = {
  // Base networks
  base: 'eip155:8453',
  'base-sepolia': 'eip155:84532',
  base_sepolia: 'eip155:84532',

  // Avalanche networks
  avalanche: 'eip155:43114',
  'avalanche-fuji': 'eip155:43113',

  // Radius networks
  radius: 'eip155:723487',
  'radius-network': 'eip155:723487',
  radius_network: 'eip155:723487',
  'radius-testnet': 'eip155:72344',
  radius_testnet: 'eip155:72344',

  // Solana networks
  solana: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  'solana-devnet': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1',
  'solana-testnet': 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z',

  // Stacks networks
  stacks: 'stacks:1',
  'stacks-mainnet': 'stacks:1',
  'stacks-testnet': 'stacks:2147483648',

  // Stellar networks
  stellar: 'stellar:pubnet',
  'stellar-testnet': 'stellar:testnet',

  // Aptos networks
  aptos: 'aptos:1',
} as const satisfies Record<string, string>

// Look up canonical CAIP-2 identifier from simple name (case-insensitive)
export function getCanonicalNetwork(name: string): string | undefined {
  const normalized = name.toLowerCase()
  return SIMPLE_NAME_TO_CAIP2[normalized as keyof typeof SIMPLE_NAME_TO_CAIP2]
}
