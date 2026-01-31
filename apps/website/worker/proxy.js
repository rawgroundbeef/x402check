/**
 * x402check CORS Proxy
 * Cloudflare Worker that proxies requests to arbitrary URLs with CORS headers.
 * Enables browser fetching of x402 configs from any endpoint.
 */

// Allowed origins for CORS requests
const allowedOrigins = [
  'https://x402check.com',
  'https://www.x402check.com',
  'https://x402check.pages.dev',
  'http://localhost:8000',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://127.0.0.1:8000',
  'http://127.0.0.1:8080',
];

// Internal IP patterns to block (SSRF protection)
const internalPatterns = [
  /^169\.254\./,        // Link-local
  /^10\./,              // Private Class A
  /^192\.168\./,        // Private Class C
  /^172\.(1[6-9]|2[0-9]|3[01])\./, // Private Class B
  /^127\./,             // Loopback
  /^0\./,               // Current network
  /^localhost$/i,       // localhost hostname
];

/**
 * Check if a hostname is an internal/private address
 */
function isInternalHost(hostname) {
  for (const pattern of internalPatterns) {
    if (pattern.test(hostname)) {
      return true;
    }
  }
  return false;
}

/**
 * Handle CORS preflight OPTIONS requests
 */
function handleOptions(request) {
  const origin = request.headers.get('Origin');
  const allowOrigin = (origin && allowedOrigins.includes(origin)) ? origin : allowedOrigins[0];

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}

/**
 * Create error response with CORS headers
 */
function errorResponse(message, status, origin) {
  const allowOrigin = (origin && allowedOrigins.includes(origin)) ? origin : '*';

  return new Response(message, {
    status,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin': allowOrigin,
    },
  });
}

export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Validate Origin header (allow null for direct browser navigation/testing)
    const isAllowedOrigin = origin === null ||
      allowedOrigins.includes(origin) ||
      (origin && origin.endsWith('.x402check.pages.dev'));

    if (!isAllowedOrigin) {
      return errorResponse('Forbidden', 403, null);
    }

    // Extract target URL and method from query parameters
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');
    const method = url.searchParams.get('method') || 'GET';

    if (!targetUrl) {
      return errorResponse('Missing ?url= parameter', 400, origin);
    }

    // Validate method
    const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'];
    if (!allowedMethods.includes(method.toUpperCase())) {
      return errorResponse(`Invalid method: ${method}`, 400, origin);
    }

    // Validate target URL format
    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl);
    } catch (e) {
      return errorResponse('Invalid target URL', 400, origin);
    }

    // Block internal IP addresses (SSRF protection)
    if (isInternalHost(parsedUrl.hostname)) {
      return errorResponse('Internal URLs not allowed', 403, origin);
    }

    // Forward request to target URL
    let response;
    try {
      response = await fetch(targetUrl, {
        method: method.toUpperCase(),
        headers: {
          'User-Agent': 'x402check/1.0',
        },
      });
    } catch (error) {
      return errorResponse(`Proxy error: ${error.message}`, 502, origin);
    }

    // Build response with CORS headers
    const newHeaders = new Headers(response.headers);
    const allowOrigin = (origin && allowedOrigins.includes(origin)) ? origin : '*';

    newHeaders.set('Access-Control-Allow-Origin', allowOrigin);
    newHeaders.set('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, X-Payment');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
