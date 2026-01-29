// x402check SDK - entry point
// Named exports only (no default) for IIFE compatibility

// Re-export types (Phase 6 Plan 01)
export * from './types'

// Re-export detection when available (Phase 6)
// export { detect, normalize } from './detection'

// Re-export validation when available (Phase 8)
// export { validate } from './validation'

// Version constant
export const VERSION = '0.0.1' as const
