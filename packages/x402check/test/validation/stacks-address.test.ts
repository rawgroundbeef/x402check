import { describe, test, expect } from 'vitest'
import { validateStacksAddress } from '../../src/validation/stacks-address'
import { ErrorCode } from '../../src/types/errors'

describe('validateStacksAddress', () => {
  describe('valid Stacks addresses', () => {
    test('mainnet standard address (SP) on stacks:1', () => {
      const issues = validateStacksAddress(
        'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
        'stacks:1',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('mainnet contract address (SM) on stacks:1', () => {
      const issues = validateStacksAddress(
        'SM2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
        'stacks:1',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('testnet standard address (ST) on stacks:2147483648', () => {
      const issues = validateStacksAddress(
        'ST000000000000000000002AMW42H',
        'stacks:2147483648',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('testnet contract address (SN) on stacks:2147483648', () => {
      const issues = validateStacksAddress(
        'SN000000000000000000003YDHWKJ',
        'stacks:2147483648',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })

    test('address with contract name suffix', () => {
      const issues = validateStacksAddress(
        'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7.my-contract',
        'stacks:1',
        'test.address'
      )
      expect(issues).toHaveLength(0)
    })
  })

  describe('invalid format', () => {
    test('empty string', () => {
      const issues = validateStacksAddress('', 'stacks:1', 'test.address')

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_STACKS_ADDRESS)
      expect(issues[0]?.message).toContain('Invalid Stacks address format')
    })

    test('random gibberish', () => {
      const issues = validateStacksAddress(
        'notanaddress',
        'stacks:1',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_STACKS_ADDRESS)
    })

    test('wrong prefix (SA)', () => {
      const issues = validateStacksAddress(
        'SA2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
        'stacks:1',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_STACKS_ADDRESS)
    })

    test('does not start with S', () => {
      const issues = validateStacksAddress(
        'XP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
        'stacks:1',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_STACKS_ADDRESS)
    })
  })

  describe('invalid checksum', () => {
    test('valid format but corrupted checksum', () => {
      // Change last character to corrupt checksum
      const issues = validateStacksAddress(
        'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJX',
        'stacks:1',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_STACKS_ADDRESS)
      expect(issues[0]?.message).toContain('checksum')
      expect(issues[0]?.message).toContain('Double-check')
    })

    test('valid prefix but invalid body', () => {
      const issues = validateStacksAddress(
        'SP00000000000000000000000000000000000000',
        'stacks:1',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_STACKS_ADDRESS)
    })
  })

  describe('network mismatch', () => {
    test('mainnet address (SP) on testnet network', () => {
      const issues = validateStacksAddress(
        'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7',
        'stacks:2147483648',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.STACKS_NETWORK_MISMATCH)
      expect(issues[0]?.message).toContain('mainnet address')
      expect(issues[0]?.message).toContain('testnet')
      expect(issues[0]?.fix).toContain('stacks:1')
    })

    test('mainnet contract address (SM) on testnet network', () => {
      const issues = validateStacksAddress(
        'SM2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKQVX8X0G',
        'stacks:2147483648',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.STACKS_NETWORK_MISMATCH)
      expect(issues[0]?.message).toContain('mainnet address')
      expect(issues[0]?.message).toContain('testnet')
    })

    test('testnet address (ST) on mainnet network', () => {
      const issues = validateStacksAddress(
        'ST000000000000000000002AMW42H',
        'stacks:1',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.STACKS_NETWORK_MISMATCH)
      expect(issues[0]?.message).toContain('testnet address')
      expect(issues[0]?.message).toContain('mainnet')
      expect(issues[0]?.fix).toContain('stacks:2147483648')
    })

    test('testnet contract address (SN) on mainnet network', () => {
      const issues = validateStacksAddress(
        'SN000000000000000000003YDHWKJ',
        'stacks:1',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.STACKS_NETWORK_MISMATCH)
      expect(issues[0]?.message).toContain('testnet address')
      expect(issues[0]?.message).toContain('mainnet')
    })
  })

  describe('contract name handling', () => {
    test('address with contract name validates base address', () => {
      const issues = validateStacksAddress(
        'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7.token-contract',
        'stacks:1',
        'test.address'
      )

      expect(issues).toHaveLength(0)
    })

    test('invalid address with contract name fails validation', () => {
      const issues = validateStacksAddress(
        'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJX.contract',
        'stacks:1',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.severity).toBe('error')
      expect(issues[0]?.code).toBe(ErrorCode.INVALID_STACKS_ADDRESS)
    })

    test('network mismatch detected with contract name', () => {
      const issues = validateStacksAddress(
        'SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7.contract',
        'stacks:2147483648',
        'test.address'
      )

      expect(issues).toHaveLength(1)
      expect(issues[0]?.code).toBe(ErrorCode.STACKS_NETWORK_MISMATCH)
    })
  })
})
