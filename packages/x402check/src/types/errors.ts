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
  INVALID_URL: 'INVALID_URL',
  INVALID_TIMEOUT: 'INVALID_TIMEOUT',

  // Address errors (codes only, validation is Phase 7)
  INVALID_EVM_ADDRESS: 'INVALID_EVM_ADDRESS',
  BAD_EVM_CHECKSUM: 'BAD_EVM_CHECKSUM',
  NO_EVM_CHECKSUM: 'NO_EVM_CHECKSUM',
  INVALID_SOLANA_ADDRESS: 'INVALID_SOLANA_ADDRESS',
  INVALID_STACKS_ADDRESS: 'INVALID_STACKS_ADDRESS',
  STACKS_NETWORK_MISMATCH: 'STACKS_NETWORK_MISMATCH',
  ADDRESS_NETWORK_MISMATCH: 'ADDRESS_NETWORK_MISMATCH',

  // Manifest errors
  MISSING_ENDPOINTS: 'MISSING_ENDPOINTS',
  INVALID_ENDPOINTS: 'INVALID_ENDPOINTS',
  EMPTY_ENDPOINTS: 'EMPTY_ENDPOINTS',
  INVALID_ENDPOINT_CONFIG: 'INVALID_ENDPOINT_CONFIG',
  WILD_MANIFEST_ARRAY_FORMAT: 'WILD_MANIFEST_ARRAY_FORMAT',
  WILD_MANIFEST_NESTED_FORMAT: 'WILD_MANIFEST_NESTED_FORMAT',
  WILD_MANIFEST_NAME_PROMOTED: 'WILD_MANIFEST_NAME_PROMOTED',

  // Manifest validation (Phase 13)
  DUPLICATE_ENDPOINT_URL: 'DUPLICATE_ENDPOINT_URL',
  MIXED_NETWORKS: 'MIXED_NETWORKS',
  DUPLICATE_BAZAAR_ROUTE: 'DUPLICATE_BAZAAR_ROUTE',
  BAZAAR_GET_WITH_BODY: 'BAZAAR_GET_WITH_BODY',
  BAZAAR_GET_MISSING_QUERY_PARAMS: 'BAZAAR_GET_MISSING_QUERY_PARAMS',
  BAZAAR_POST_WITH_QUERY_PARAMS: 'BAZAAR_POST_WITH_QUERY_PARAMS',
  BAZAAR_POST_MISSING_BODY: 'BAZAAR_POST_MISSING_BODY',

  // Extension / schema warnings
  INVALID_BAZAAR_INFO: 'INVALID_BAZAAR_INFO',
  INVALID_BAZAAR_SCHEMA: 'INVALID_BAZAAR_SCHEMA',
  INVALID_BAZAAR_INFO_INPUT: 'INVALID_BAZAAR_INFO_INPUT',
  INVALID_OUTPUT_SCHEMA: 'INVALID_OUTPUT_SCHEMA',
  INVALID_OUTPUT_SCHEMA_INPUT: 'INVALID_OUTPUT_SCHEMA_INPUT',
  MISSING_INPUT_SCHEMA: 'MISSING_INPUT_SCHEMA',

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
  UNKNOWN_FORMAT: 'Missing required x402Version field (must be 1 or 2)',

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
  INVALID_URL: 'resource.url is not a valid URL format',
  INVALID_TIMEOUT: 'maxTimeoutSeconds must be a positive integer',

  // Address errors
  INVALID_EVM_ADDRESS: 'Invalid EVM address format',
  BAD_EVM_CHECKSUM: 'EVM address has invalid checksum',
  NO_EVM_CHECKSUM: 'EVM address is all-lowercase with no checksum protection',
  INVALID_SOLANA_ADDRESS: 'Invalid Solana address format',
  INVALID_STACKS_ADDRESS: 'Invalid Stacks address',
  STACKS_NETWORK_MISMATCH: 'Stacks address does not match the specified network',
  ADDRESS_NETWORK_MISMATCH: 'Address format does not match network type',

  // Manifest errors
  MISSING_ENDPOINTS: 'Manifest must have an endpoints field',
  INVALID_ENDPOINTS: 'endpoints must be a Record (object) mapping IDs to v2 configs',
  EMPTY_ENDPOINTS: 'Manifest has no endpoints defined',
  INVALID_ENDPOINT_CONFIG: 'Endpoint config is not a valid v2 PaymentRequired object',
  WILD_MANIFEST_ARRAY_FORMAT: 'Detected non-standard array format, normalized to endpoints collection',
  WILD_MANIFEST_NESTED_FORMAT: 'Detected non-standard nested service format, normalized to endpoints collection',
  WILD_MANIFEST_NAME_PROMOTED: 'Top-level name field promoted to service.name',

  // Manifest validation (Phase 13)
  DUPLICATE_ENDPOINT_URL: 'Multiple endpoints share the same URL',
  MIXED_NETWORKS: 'Manifest contains both mainnet and testnet networks',
  DUPLICATE_BAZAAR_ROUTE: 'Multiple endpoints share the same HTTP method + path',
  BAZAAR_GET_WITH_BODY: 'GET requests cannot have body input shape',
  BAZAAR_GET_MISSING_QUERY_PARAMS: 'GET requests should define queryParams input shape',
  BAZAAR_POST_WITH_QUERY_PARAMS: 'POST/PUT/PATCH/DELETE requests should not use queryParams input shape',
  BAZAAR_POST_MISSING_BODY: 'POST/PUT/PATCH/DELETE requests should define body input shape',

  // Extension / schema warnings
  INVALID_BAZAAR_INFO: 'extensions.bazaar.info must be an object with input and output',
  INVALID_BAZAAR_SCHEMA: 'extensions.bazaar.schema must be a valid JSON Schema object',
  INVALID_BAZAAR_INFO_INPUT: 'extensions.bazaar.info.input must include type and method',
  INVALID_OUTPUT_SCHEMA: 'accepts[i].outputSchema must be an object with input and output',
  INVALID_OUTPUT_SCHEMA_INPUT: 'accepts[i].outputSchema.input must include type and method',
  MISSING_INPUT_SCHEMA: 'No input schema found (no bazaar extension or outputSchema) -- consider adding one so agents know how to call your API',

  // Warnings
  UNKNOWN_NETWORK: 'Network is not in the known registry -- config may still work but cannot be fully validated',
  UNKNOWN_ASSET: 'Asset is not in the known registry -- config may still work but cannot be fully validated',
  LEGACY_FORMAT: 'Config uses legacy flat format -- consider upgrading to x402 v2',
  MISSING_MAX_TIMEOUT: 'Consider adding maxTimeoutSeconds for better security',
} satisfies Record<ErrorCode, string>
