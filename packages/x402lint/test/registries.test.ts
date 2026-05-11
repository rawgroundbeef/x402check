import { describe, it, expect } from 'vitest'
import {
  KNOWN_NETWORKS,
  KNOWN_ASSETS,
  SIMPLE_NAME_TO_CAIP2,
  CAIP2_REGEX,
  isValidCaip2,
  isKnownNetwork,
  getNetworkInfo,
  getNetworkNamespace,
  getCanonicalNetwork,
  isKnownAsset,
  getAssetInfo,
} from '../src/index'

describe('CAIP-2 validation', () => {
  it('validates correct CAIP-2 format', () => {
    expect(isValidCaip2('eip155:8453')).toBe(true)
    expect(isValidCaip2('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBe(true)
    expect(isValidCaip2('stellar:pubnet')).toBe(true)
    expect(isValidCaip2('aptos:1')).toBe(true)
  })

  it('rejects invalid CAIP-2 format', () => {
    expect(isValidCaip2('base')).toBe(false) // no colon
    expect(isValidCaip2('')).toBe(false) // empty
    expect(isValidCaip2('a:b')).toBe(false) // namespace too short
    expect(isValidCaip2('UPPERCASE:123')).toBe(false) // namespace must be lowercase
    expect(isValidCaip2('eip155:')).toBe(false) // missing reference
  })
})

describe('network registry', () => {
  it('contains all specified networks', () => {
    expect(isKnownNetwork('eip155:8453')).toBe(true) // Base
    expect(isKnownNetwork('eip155:84532')).toBe(true) // Base Sepolia
    expect(isKnownNetwork('eip155:43114')).toBe(true) // Avalanche
    expect(isKnownNetwork('eip155:43113')).toBe(true) // Avalanche Fuji
    expect(isKnownNetwork('eip155:723487')).toBe(true) // Radius Network
    expect(isKnownNetwork('eip155:72344')).toBe(true) // Radius Testnet
    expect(isKnownNetwork('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBe(true)
    expect(isKnownNetwork('stellar:pubnet')).toBe(true)
  })

  it('returns correct network info', () => {
    const base = getNetworkInfo('eip155:8453')
    expect(base).toBeDefined()
    expect(base!.name).toBe('Base')
    expect(base!.type).toBe('evm')
    expect(base!.testnet).toBe(false)
  })

  it('returns undefined for unknown networks', () => {
    expect(getNetworkInfo('eip155:999999')).toBeUndefined()
  })

  it('extracts namespace from CAIP-2', () => {
    expect(getNetworkNamespace('eip155:8453')).toBe('eip155')
    expect(getNetworkNamespace('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')).toBe('solana')
    expect(getNetworkNamespace('not-valid')).toBeUndefined()
  })
})

describe('simple name mapping', () => {
  it('maps simple names to CAIP-2', () => {
    expect(getCanonicalNetwork('base')).toBe('eip155:8453')
    expect(getCanonicalNetwork('radius')).toBe('eip155:723487')
    expect(getCanonicalNetwork('radius-testnet')).toBe('eip155:72344')
    expect(getCanonicalNetwork('solana')).toBe('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
    expect(getCanonicalNetwork('stellar')).toBe('stellar:pubnet')
  })

  it('is case-insensitive', () => {
    expect(getCanonicalNetwork('Base')).toBe('eip155:8453')
    expect(getCanonicalNetwork('BASE')).toBe('eip155:8453')
  })

  it('returns undefined for unknown names', () => {
    expect(getCanonicalNetwork('ethereum')).toBeUndefined()
    expect(getCanonicalNetwork('polygon')).toBeUndefined()
  })
})

describe('asset registry', () => {
  it('finds USDC on Base', () => {
    const usdc = getAssetInfo('eip155:8453', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
    expect(usdc).toBeDefined()
    expect(usdc!.symbol).toBe('USDC')
    expect(usdc!.decimals).toBe(6)
  })

  it('finds USDC on Solana', () => {
    expect(
      isKnownAsset(
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      ),
    ).toBe(true)
  })

  it('finds SBC on Radius mainnet and testnet', () => {
    expect(
      getAssetInfo('eip155:723487', '0x33ad9e4BD16B69B5BFdED37D8B5D9fF9aba014Fb'),
    ).toMatchObject({
      symbol: 'SBC',
      name: 'Stable Coin',
      decimals: 6,
    })
    expect(
      isKnownAsset('eip155:72344', '0x33ad9e4BD16B69B5BFdED37D8B5D9fF9aba014Fb'),
    ).toBe(true)
  })

  it('returns undefined for unknown assets', () => {
    expect(
      getAssetInfo('eip155:8453', '0x0000000000000000000000000000000000000000'),
    ).toBeUndefined()
  })

  it('returns undefined for unknown network', () => {
    expect(
      getAssetInfo('eip155:999999', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'),
    ).toBeUndefined()
  })
})
