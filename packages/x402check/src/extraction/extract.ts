/**
 * HTTP config extraction
 *
 * Extracts x402 payment configs from HTTP 402 responses.
 * Handles body-first extraction with PAYMENT-REQUIRED header fallback.
 */

/**
 * Where the config was found
 */
export type ExtractionSource = 'body' | 'header'

/**
 * Result of extracting a config from an HTTP response
 */
export interface ExtractionResult {
  config: object | null
  source: ExtractionSource | null
  error: string | null
}

/**
 * Minimal response shape — works with fetch Response, plain objects, etc.
 */
export interface ResponseLike {
  body?: unknown
  headers?: Record<string, string> | Headers
}

/**
 * Get a header value, case-insensitive.
 * Supports both Headers objects and plain Record<string, string>.
 */
function getHeader(
  headers: Record<string, string> | Headers | undefined,
  name: string,
): string | null {
  if (!headers) return null

  // Headers object (fetch API)
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get(name)
  }

  // Plain object — case-insensitive lookup
  const lower = name.toLowerCase()
  for (const key of Object.keys(headers as Record<string, string>)) {
    if (key.toLowerCase() === lower) {
      return (headers as Record<string, string>)[key]!
    }
  }
  return null
}

/**
 * Decode base64 string to UTF-8 text.
 * Works in both browser (atob) and Node (Buffer).
 */
function decodeBase64(encoded: string): string {
  if (typeof atob === 'function') {
    return atob(encoded)
  }
  // Node.js fallback
  return Buffer.from(encoded, 'base64').toString('utf-8')
}

/**
 * Check if a parsed object looks like it contains x402 config fields.
 */
function hasX402Fields(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false
  const rec = obj as Record<string, unknown>
  return !!(rec.accepts || rec.payTo || rec.x402Version)
}

/**
 * Try to parse the PAYMENT-REQUIRED header value as a base64-encoded JSON config.
 */
function tryHeaderExtraction(
  headers: Record<string, string> | Headers | undefined,
): { config: object; source: 'header' } | null {
  const headerValue = getHeader(headers, 'payment-required')
  if (!headerValue) return null

  // Try base64 decode first
  try {
    const decoded = decodeBase64(headerValue)
    const parsed = JSON.parse(decoded) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { config: parsed as object, source: 'header' }
    }
  } catch {
    // Not valid base64 JSON
  }

  // Try raw JSON (some implementations don't base64-encode)
  try {
    const parsed = JSON.parse(headerValue) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return { config: parsed as object, source: 'header' }
    }
  } catch {
    // Not valid JSON either
  }

  return null
}

/**
 * Extract an x402 config from an HTTP 402 response.
 *
 * Extraction priority:
 * 1. JSON body — if it parses and has x402 fields (accepts, payTo, x402Version)
 * 2. PAYMENT-REQUIRED header — base64-decoded JSON fallback
 *
 * Never throws. Returns structured result with error message on failure.
 *
 * @param response - Response-like object with body and/or headers
 * @returns Extraction result with config, source, and error
 */
export function extractConfig(response: ResponseLike): ExtractionResult {
  // Try body first
  const body = response.body
  if (body && typeof body === 'object' && !Array.isArray(body) && hasX402Fields(body)) {
    return { config: body as object, source: 'body', error: null }
  }

  // Try string body (JSON string)
  if (typeof body === 'string' && body.trim()) {
    try {
      const parsed = JSON.parse(body) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && hasX402Fields(parsed)) {
        return { config: parsed as object, source: 'body', error: null }
      }
    } catch {
      // Body is not valid JSON, fall through to header
    }
  }

  // Fallback to PAYMENT-REQUIRED header
  const headerResult = tryHeaderExtraction(response.headers)
  if (headerResult) {
    return { config: headerResult.config, source: headerResult.source, error: null }
  }

  return {
    config: null,
    source: null,
    error: 'No x402 config found in response body or PAYMENT-REQUIRED header',
  }
}
