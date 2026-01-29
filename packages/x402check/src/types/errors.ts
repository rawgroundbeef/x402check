/**
 * Error and warning code vocabulary for x402check
 */

export const ErrorCode = {
  // Structure errors
  INVALID_JSON: 'INVALID_JSON',
  NOT_OBJECT: 'NOT_OBJECT',
  UNKNOWN_FORMAT: 'UNKNOWN_FORMAT',

  // Version errors
  MISSING_VERSION: 'MISSING_VERSION',
  INVALID_VERSION: 'INVALID_VERSION',

  // Accepts errors
  MISSING_ACCEPTS: 'MISSING_ACCEPTS',
  EMPTY_ACCEPTS: 'EMPTY_ACCEPTS',
  INVALID_ACCEPTS: 'INVALID_ACCEPTS',

  // Field errors
  MISSING_SCHEME: 'MISSING_SCHEME',
  MISSING_NETWORK: 'MISSING_NETWORK',
  INVALID_NETWORK_FORMAT: 'INVALID_NETWORK_FORMAT',
  MISSING_AMOUNT: 'MISSING_AMOUNT',
  INVALID_AMOUNT: 'INVALID_AMOUNT',
  ZERO_AMOUNT: 'ZERO_AMOUNT',
  MISSING_ASSET: 'MISSING_ASSET',
  MISSING_PAY_TO: 'MISSING_PAY_TO',
  MISSING_RESOURCE: 'MISSING_RESOURCE',

  // Address errors (codes only, validation is Phase 7)
  INVALID_EVM_ADDRESS: 'INVALID_EVM_ADDRESS',
  BAD_EVM_CHECKSUM: 'BAD_EVM_CHECKSUM',
  NO_EVM_CHECKSUM: 'NO_EVM_CHECKSUM',
  INVALID_SOLANA_ADDRESS: 'INVALID_SOLANA_ADDRESS',
  ADDRESS_NETWORK_MISMATCH: 'ADDRESS_NETWORK_MISMATCH',

  // Warning codes
  UNKNOWN_NETWORK: 'UNKNOWN_NETWORK',
  UNKNOWN_ASSET: 'UNKNOWN_ASSET',
  LEGACY_FORMAT: 'LEGACY_FORMAT',
  MISSING_MAX_TIMEOUT: 'MISSING_MAX_TIMEOUT',
} as const

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]

/**
 * Human-readable error messages for all error codes
 */
export const ErrorMessages = {
  // Structure errors
  INVALID_JSON: 'Input is not valid JSON',
  NOT_OBJECT: 'Input must be an object',
  UNKNOWN_FORMAT: 'Config format could not be detected',

  // Version errors
  MISSING_VERSION: 'Missing required field: x402Version',
  INVALID_VERSION: 'Invalid x402Version value (must be 1 or 2)',

  // Accepts errors
  MISSING_ACCEPTS: 'Missing required field: accepts',
  EMPTY_ACCEPTS: 'accepts array cannot be empty',
  INVALID_ACCEPTS: 'accepts must be an array',

  // Field errors
  MISSING_SCHEME: 'Missing required field: scheme',
  MISSING_NETWORK: 'Missing required field: network',
  INVALID_NETWORK_FORMAT: 'Network must use CAIP-2 format (namespace:reference), e.g. eip155:8453',
  MISSING_AMOUNT: 'Missing required field: amount',
  INVALID_AMOUNT: 'Amount must be a numeric string in atomic units',
  ZERO_AMOUNT: 'Amount must be greater than zero',
  MISSING_ASSET: 'Missing required field: asset',
  MISSING_PAY_TO: 'Missing required field: payTo',
  MISSING_RESOURCE: 'Missing required field: resource',

  // Address errors
  INVALID_EVM_ADDRESS: 'Invalid EVM address format',
  BAD_EVM_CHECKSUM: 'EVM address has invalid checksum',
  NO_EVM_CHECKSUM: 'EVM address is all-lowercase with no checksum protection',
  INVALID_SOLANA_ADDRESS: 'Invalid Solana address format',
  ADDRESS_NETWORK_MISMATCH: 'Address format does not match network type',

  // Warnings
  UNKNOWN_NETWORK: 'Network is not in the known registry -- config may still work but cannot be fully validated',
  UNKNOWN_ASSET: 'Asset is not in the known registry -- config may still work but cannot be fully validated',
  LEGACY_FORMAT: 'Config uses legacy flat format -- consider upgrading to x402 v2',
  MISSING_MAX_TIMEOUT: 'Consider adding maxTimeoutSeconds for better security',
} satisfies Record<ErrorCode, string>
