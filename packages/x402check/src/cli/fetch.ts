/**
 * URL fetching with redirect tracking
 *
 * Provides fetch with manual redirect handling, timeout, and custom headers.
 */

/**
 * Result of a successful fetch operation
 */
export interface FetchResult {
  status: number
  body: unknown
  headers: Record<string, string>
}

/**
 * Fetch a URL with manual redirect tracking and timeout
 *
 * @param url - URL to fetch
 * @param options - Fetch options (headers, maxRedirects, timeoutMs)
 * @returns FetchResult with status, body, and headers
 * @throws Error if redirect limit exceeded, timeout, or other fetch failure
 *
 * Features:
 * - Follows redirects manually (301/302/303/307/308) up to maxRedirects
 * - Resolves relative Location headers against current URL
 * - Configurable timeout (default 10s)
 * - Accepts custom headers for authentication
 * - Auto-parses JSON responses based on Content-Type
 */
export async function fetchWithRedirects(
  url: string,
  options?: {
    headers?: Record<string, string>
    maxRedirects?: number
    timeoutMs?: number
  }
): Promise<FetchResult> {
  const maxRedirects = options?.maxRedirects ?? 5
  const timeoutMs = options?.timeoutMs ?? 10000

  let currentUrl = url
  let redirectCount = 0

  while (redirectCount <= maxRedirects) {
    const fetchOptions: RequestInit = {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    }

    if (options?.headers) {
      fetchOptions.headers = options.headers
    }

    const res = await fetch(currentUrl, fetchOptions)

    // Check if response is a redirect
    const status = res.status
    if (status === 301 || status === 302 || status === 303 || status === 307 || status === 308) {
      const location = res.headers.get('Location')
      if (!location) {
        throw new Error('Redirect without Location header')
      }

      redirectCount++
      if (redirectCount > maxRedirects) {
        throw new Error(`Too many redirects (limit: ${maxRedirects})`)
      }

      // Resolve relative URL against current URL
      currentUrl = new URL(location, currentUrl).href
      continue
    }

    // Non-redirect response - process and return
    const headers: Record<string, string> = {}
    res.headers.forEach((value, key) => {
      headers[key] = value
    })

    let body: unknown
    const ct = res.headers.get('content-type') || ''
    if (ct.includes('json')) {
      body = await res.json()
    } else {
      body = await res.text()
    }

    return { status, body, headers }
  }

  // Should never reach here, but safeguard against infinite loops
  throw new Error('Redirect loop detected')
}
