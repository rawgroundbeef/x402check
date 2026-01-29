// x402check SDK - entry point
// Named exports only (no default) for IIFE compatibility

// Re-export types (Phase 6 Plan 01)
export * from './types'

// Re-export registries (Phase 6 Plan 03)
export * from './registries'

// Re-export detection (Phase 6 Plan 02)
export { detect, normalize } from './detection'

// Re-export crypto primitives (Phase 7 Plan 01)
export * from './crypto'

// Re-export validation utilities (Phase 7 Plan 02)
export { validateAddress, validateEvmAddress, validateSolanaAddress } from './validation'

// Re-export validation orchestrator (Phase 8)
export { validate } from './validation'
export type { ValidationOptions } from './validation'

// Version constant
export const VERSION = '0.0.1' as const
