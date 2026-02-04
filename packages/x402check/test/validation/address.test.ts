import { describe, test, expect } from 'vitest'
import { validateAddress } from '../../src/validation/address'
import { ErrorCode } from '../../src/types/errors'

describe('validateAddress', () => {
  describe('EVM addresses on EVM networks', () => {
    test('valid checksummed address on Base', () => {
      const issues = validateAddress(
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        'eip155:8453',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })

    test('valid checksummed address on unknown EVM network', () => {
      const issues = validateAddress(
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        'eip155:999999',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })
  })

  describe('Solana addresses on Solana networks', () => {
    test('valid address on Solana mainnet', () => {
      const issues = validateAddress(
        '11111111111111111111111111111111',
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })

    test('valid SPL Token program address', () => {
      const issues = validateAddress(
        'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })
  })

  describe('Stacks addresses on Stacks networks', () => {
    test('valid mainnet address (SP) on stacks:1', () => {
      const issues = validateAddress(
        'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
        'stacks:1',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })

    test('valid testnet address (ST) on stacks:2147483648', () => {
      const issues = validateAddress(
        'ST000000000000000000002AMW42H',
        'stacks:2147483648',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })
  })

  describe('cross-chain mismatches', () => {
    test('EVM address on Solana network produces error', () => {
      const issues = validateAddress(
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
        'accepts[0].payTo'
      )

      expect(issues.length).toBeGreaterThan(0)
      expect(issues.some((i) => i.severity === 'error')).toBe(true)
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_SOLANA_ADDRESS)
    })

    test('Solana address on EVM network produces error', () => {
      const issues = validateAddress(
        '11111111111111111111111111111111',
        'eip155:8453',
        'accepts[0].payTo'
      )

      expect(issues.length).toBeGreaterThan(0)
      expect(issues.some((i) => i.severity === 'error')).toBe(true)
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_EVM_ADDRESS)
    })

    test('Stacks address on EVM network produces error', () => {
      const issues = validateAddress(
        'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
        'eip155:8453',
        'accepts[0].payTo'
      )

      expect(issues.length).toBeGreaterThan(0)
      expect(issues.some((i) => i.severity === 'error')).toBe(true)
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_EVM_ADDRESS)
    })

    test('EVM address on Stacks network produces error', () => {
      const issues = validateAddress(
        '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        'stacks:1',
        'accepts[0].payTo'
      )

      expect(issues.length).toBeGreaterThan(0)
      expect(issues.some((i) => i.severity === 'error')).toBe(true)
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_STACKS_ADDRESS)
    })
  })

  describe('Stellar namespace', () => {
    test('accepts any address (deep validation deferred)', () => {
      const issues = validateAddress(
        'GBDEVU63Y6NTHJQQZIKVTC23NWLQVP3WJ2RI2OTSJTNYOIGICST6DUXR',
        'stellar:pubnet',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })

    test('accepts even invalid-looking addresses', () => {
      const issues = validateAddress(
        'not-a-real-stellar-address',
        'stellar:pubnet',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })
  })

  describe('Aptos namespace', () => {
    test('accepts any address (deep validation deferred)', () => {
      const issues = validateAddress(
        '0x1',
        'aptos:1',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })

    test('accepts longer addresses', () => {
      const issues = validateAddress(
        '0x1234567890abcdef',
        'aptos:1',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })
  })

  describe('unknown namespaces', () => {
    test('returns empty (unknown namespace handling is Phase 8)', () => {
      const issues = validateAddress(
        'someaddress',
        'bitcoin:mainnet',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })
  })

  describe('invalid CAIP-2 network', () => {
    test('returns empty (network format errors are Phase 8)', () => {
      const issues = validateAddress(
        'someaddress',
        'not-valid-caip2',
        'accepts[0].payTo'
      )
      expect(issues).toHaveLength(0)
    })
  })
})
