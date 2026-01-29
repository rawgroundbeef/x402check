import { ErrorCode, ErrorMessages } from './errors'
import type { ParsedInput } from './validation'

/**
 * Parse input that may be either a JSON string or an object
 * API-04: Accept string | object
 */
export function parseInput(input: string | object): ParsedInput {
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input)
      return { parsed }
    } catch {
      return {
        parsed: null,
        error: {
          code: ErrorCode.INVALID_JSON,
          field: '$',
          message: ErrorMessages.INVALID_JSON,
          severity: 'error',
        },
      }
    }
  }

  // typeof input === 'object'
  return { parsed: input }
}
