# Phase 2: Input & Proxy - Research

**Researched:** 2026-01-22
**Domain:** Smart input detection, URL fetching via CORS proxy, HTTP header extraction
**Confidence:** HIGH

## Summary

Phase 2 adds a smart input layer on top of the existing validation engine (Phase 1). The core challenges are: (1) auto-detecting URL vs JSON input without tabs/toggles, (2) fetching URLs via Cloudflare Worker proxy to bypass CORS restrictions, (3) extracting x402 config from X-Payment header or response body with proper fallback logic, and (4) handling loading states and network errors gracefully.

**Standard approach:** Use native fetch API with AbortSignal.timeout() for request timeouts, Cloudflare Workers for CORS proxy (free tier: 100k requests/day), and vanilla JS for input detection. The x402 protocol (v2, 2026) moved payment data to headers (PAYMENT-REQUIRED header) but servers may still include config in response body for compatibility.

**Primary recommendation:** Single textarea with `.startsWith('http')` detection, CSS Grid auto-expand technique for height animation, Cloudflare Worker with Origin header validation for security, and disabled button state during fetch to prevent double-submit. Keep proxy minimal—just CORS headers and request forwarding.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Fetch API | Native | HTTP requests with timeout support | Built into all modern browsers, supports AbortSignal.timeout() |
| Cloudflare Workers | Latest | CORS proxy deployment | Free tier sufficient (100k requests/day), edge network for low latency, simple JS-based Workers |
| Wrangler CLI | Latest | Cloudflare Workers deployment | Official CLI tool, `npx wrangler deploy` single command |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| JSON.stringify | Native | Pretty-print JSON (space param) | Format pasted JSON for readability, already in Phase 1 |
| AbortController | Native | Manual timeout control | If need to cancel fetch manually (not just timeout) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Cloudflare Workers | AWS Lambda@Edge | More complex setup, higher cost, slower cold starts |
| Fetch API | XMLHttpRequest | Outdated, verbose, no Promise support, no AbortSignal |
| Native timeout | setTimeout + abort() | AbortSignal.timeout() is cleaner, avoids manual cleanup |
| Public CORS proxies | cors-anywhere.herokuapp.com | Unreliable, rate-limited, privacy concerns, often shut down |

**Installation (Cloudflare Workers):**
```bash
# Install Wrangler CLI (Node 16.17.0+)
npm install -g wrangler

# Create new Worker project
npm create cloudflare@latest

# Deploy Worker
npx wrangler deploy
```

## Architecture Patterns

### Recommended Project Structure
```
/
├── index.html           # Input UI + results display (existing from Phase 1)
├── validator.js         # Core validation logic (existing from Phase 1)
├── input.js             # NEW: Input handling + URL fetching
├── worker/
│   └── proxy.js         # NEW: Cloudflare Worker CORS proxy
└── wrangler.toml        # NEW: Worker configuration
```

### Pattern 1: Smart Input Detection
**What:** Detect URL vs JSON by checking if input starts with `http://` or `https://`, no tabs/toggles
**When to use:** When user wants simple paste-anything interface
**Example:**
```javascript
// Source: User CONTEXT.md decision - single input field
function detectInputType(input) {
  const trimmed = input.trim();

  // URL detection: starts with http
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'url';
  }

  // Otherwise treat as JSON
  return 'json';
}

// Handle submit
async function handleSubmit(input) {
  const type = detectInputType(input);

  if (type === 'url') {
    const config = await fetchConfigFromUrl(input);
    return validateX402Config(config);
  } else {
    return validateX402Config(input);
  }
}
```

### Pattern 2: Fetch with Timeout (AbortSignal.timeout)
**What:** Use AbortSignal.timeout() for clean timeout handling without manual cleanup
**When to use:** Always—prevents hanging requests and memory leaks
**Example:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static
// Modern approach (Chrome 103+, Firefox 100+, Safari 16+)

async function fetchWithTimeout(url, timeoutMs = 5000) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs)
    });

    return response;

  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    if (error.name === 'AbortError') {
      throw new Error('Request was cancelled');
    }
    throw error; // Network error, etc.
  }
}
```

### Pattern 3: Cloudflare Worker CORS Proxy
**What:** Minimal proxy that adds CORS headers and forwards requests to target URLs
**When to use:** When client needs to fetch from arbitrary URLs (bypasses browser CORS)
**Example:**
```javascript
// Source: https://developers.cloudflare.com/workers/examples/cors-header-proxy/
// Official Cloudflare example (simplified)

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // Handle preflight OPTIONS
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Extract target URL from query param
    const targetUrl = url.searchParams.get('url');
    if (!targetUrl) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    // Fetch from target
    const targetRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers
    });

    const response = await fetch(targetRequest);

    // Clone response and add CORS headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');

    return newResponse;
  }
}

function handleOptions(request) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || '',
      'Access-Control-Max-Age': '86400'
    }
  });
}
```

### Pattern 4: X-Payment Header Extraction
**What:** Extract x402 config from PAYMENT-REQUIRED header (v2) or response body with fallback
**When to use:** When parsing x402 endpoints (spec defines header location)
**Example:**
```javascript
// Source: User CONTEXT.md + x402 v2 spec (headers-first approach)

async function extractX402Config(response) {
  // Priority 1: PAYMENT-REQUIRED header (x402 v2 standard)
  const paymentHeader = response.headers.get('PAYMENT-REQUIRED');
  if (paymentHeader) {
    try {
      // Header contains base64-encoded JSON
      const decoded = atob(paymentHeader);
      const config = JSON.parse(decoded);
      return {
        config: JSON.stringify(config, null, 2),
        source: 'PAYMENT-REQUIRED header',
        status: response.status
      };
    } catch (e) {
      // Invalid header format
      return {
        error: `Invalid PAYMENT-REQUIRED header: ${e.message}`,
        status: response.status
      };
    }
  }

  // Priority 2: Response body fallback (v1 compatibility or 200 responses)
  const contentType = response.headers.get('Content-Type');
  if (contentType && contentType.includes('application/json')) {
    try {
      const bodyText = await response.text();
      const config = JSON.parse(bodyText); // Validate it's JSON
      return {
        config: bodyText,
        source: 'response body',
        status: response.status,
        warning: response.status !== 402 ? 'Response status: 200 — x402 endpoints should return 402 Payment Required' : null
      };
    } catch (e) {
      // Invalid JSON body
      return {
        error: 'Response body is not valid JSON',
        status: response.status
      };
    }
  }

  // No config found
  return {
    error: 'No x402 Config Found — Response had no PAYMENT-REQUIRED header or valid JSON body',
    status: response.status
  };
}
```

### Pattern 5: Loading State with Disabled Button
**What:** Disable submit button during fetch to prevent double-submit, show loading indicator
**When to use:** Always—prevents race conditions and user confusion
**Example:**
```javascript
// Source: https://www.the-art-of-web.com/javascript/doublesubmit/
// Prevent double-submit pattern

async function handleValidate(button, input) {
  // Disable button immediately
  button.disabled = true;
  button.classList.add('loading');
  const originalText = button.textContent;
  button.textContent = 'Validating...';

  try {
    const type = detectInputType(input.value);
    let configText;

    if (type === 'url') {
      configText = await fetchConfigFromUrl(input.value);
    } else {
      configText = input.value;
    }

    const result = validateX402Config(configText);
    displayResults(result);

  } catch (error) {
    displayError(error.message);

  } finally {
    // Always re-enable button
    button.disabled = false;
    button.classList.remove('loading');
    button.textContent = originalText;
  }
}
```

### Pattern 6: CSS Grid Auto-Expand Textarea
**What:** Use CSS Grid to auto-expand textarea from single-line to multi-line as content grows
**When to use:** When want smooth height animation without JavaScript scrollHeight calculations
**Example:**
```html
<!-- Source: https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/ -->
<!-- CSS Grid trick for auto-expanding textarea -->

<div class="input-wrapper" data-value="">
  <textarea
    placeholder="Paste a URL or x402 JSON config..."
    oninput="this.parentNode.dataset.value = this.value">
  </textarea>
</div>

<style>
.input-wrapper {
  display: grid;
  min-height: 50px;
  max-height: 300px;
}

.input-wrapper::after {
  content: attr(data-value) " ";
  visibility: hidden;
  white-space: pre-wrap;
  grid-area: 1 / 1 / 2 / 2;
  font: inherit;
  padding: inherit;
  border: inherit;
}

.input-wrapper > textarea {
  resize: none;
  overflow: auto;
  grid-area: 1 / 1 / 2 / 2;
  font: inherit;
  padding: 10px;
}
</style>
```

### Anti-Patterns to Avoid
- **Manual AbortController cleanup:** Use AbortSignal.timeout() instead of setTimeout + controller.abort()
- **Open CORS proxy:** Don't allow proxying arbitrary URLs without Origin header validation
- **Synchronous input detection:** Don't use expensive regex for URL detection when `.startsWith()` suffices
- **Forgetting to re-enable button:** Always use try-finally to re-enable button after fetch
- **Not extracting config source:** User wants to see "found in header" vs "found in body"

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request timeout | setTimeout + manual abort | AbortSignal.timeout() | Cleaner API, automatic cleanup, no memory leaks |
| CORS proxy | nginx/Apache config | Cloudflare Workers | No server maintenance, edge network, free tier, 5-minute setup |
| URL validation | Complex regex | `new URL()` constructor | Handles edge cases, throws on invalid, built-in |
| JSON pretty-print | Manual indentation | JSON.stringify(obj, null, 2) | Standard approach, handles nesting, no bugs |
| Textarea auto-expand | scrollHeight calculations | CSS Grid ::after technique | No JavaScript, smooth, handles edge cases |

**Key insight:** Cloudflare Workers eliminate the need for maintaining a proxy server. The free tier (100k requests/day) is sufficient for small-to-medium tools, and deployment is a single `wrangler deploy` command. Don't build custom server infrastructure when Workers handle CORS, SSL, and global edge routing automatically.

## Common Pitfalls

### Pitfall 1: AbortSignal Timeout Memory Leaks
**What goes wrong:** Using manual AbortController without cleanup causes memory leaks, especially in React/SPA contexts
**Why it happens:** Event listeners on abort signals aren't garbage collected if controller persists
**How to avoid:** Use AbortSignal.timeout() which cleans up automatically, or ensure manual controllers are aborted in cleanup
**Warning signs:** MaxListenersExceededWarning, increasing memory usage with repeated fetches
**Code:**
```javascript
// Bad: manual timeout without cleanup
const controller = new AbortController();
setTimeout(() => controller.abort(), 5000);
fetch(url, { signal: controller.signal });

// Good: automatic cleanup
fetch(url, { signal: AbortSignal.timeout(5000) });
```

### Pitfall 2: Open CORS Proxy Abuse
**What goes wrong:** Unrestricted CORS proxy becomes target for abuse, SSRF attacks, and bandwidth theft
**Why it happens:** Allowing any URL without Origin header validation lets attackers proxy traffic through your Worker
**How to avoid:** Validate Origin header matches your domain, or use allowlist of target domains
**Warning signs:** Unexpected traffic spikes, requests to internal networks (169.254.x.x, 10.x.x.x)
**Code:**
```javascript
// Bad: open proxy
const targetUrl = url.searchParams.get('url');
await fetch(targetUrl);

// Good: Origin validation
export default {
  async fetch(request) {
    const origin = request.headers.get('Origin');
    const allowedOrigins = ['https://x402check.example.com', 'http://localhost:8000'];

    if (!allowedOrigins.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Continue with proxy logic...
  }
}
```

### Pitfall 3: Not Re-enabling Button on Error
**What goes wrong:** If fetch throws error and button isn't re-enabled, user is stuck
**Why it happens:** Error thrown before button.disabled = false line executes
**How to avoid:** Always use try-finally block to guarantee button re-enable
**Warning signs:** Button stays disabled after network error, user must refresh page
**Code:**
```javascript
// Bad: button stays disabled on error
button.disabled = true;
await fetch(url);
button.disabled = false; // Never reached if fetch throws

// Good: guaranteed re-enable
button.disabled = true;
try {
  await fetch(url);
} finally {
  button.disabled = false; // Always executes
}
```

### Pitfall 4: X-Payment Header Case Sensitivity
**What goes wrong:** Looking for 'X-Payment' header but it's actually 'x-payment' or 'PAYMENT-REQUIRED'
**Why it happens:** HTTP headers are case-insensitive but .get() might be case-sensitive in some implementations
**How to avoid:** Use correct x402 v2 header name ('PAYMENT-REQUIRED') and use lowercase with .get()
**Warning signs:** Header exists in DevTools but code says null
**Code:**
```javascript
// Bad: wrong header name and case
const payment = response.headers.get('X-Payment');

// Good: correct x402 v2 header name
const payment = response.headers.get('PAYMENT-REQUIRED'); // Case-insensitive in fetch
```

### Pitfall 5: Response Body Already Read
**What goes wrong:** Calling .text() twice on same response throws "Body already read" error
**Why it happens:** Response body is a stream that can only be read once
**How to avoid:** Store body text in variable, or clone response before reading
**Warning signs:** "Failed to execute 'text' on 'Response': body stream already read"
**Code:**
```javascript
// Bad: reading body twice
const json = await response.json();
const text = await response.text(); // Error: already read

// Good: read once and store
const text = await response.text();
const json = JSON.parse(text);

// Good: clone response
const json = await response.clone().json();
const text = await response.text();
```

### Pitfall 6: URL Detection False Positives
**What goes wrong:** Input like "http://malformed url" passes startsWith check but fails fetch
**Why it happens:** startsWith() doesn't validate URL format, only checks prefix
**How to avoid:** Use URL constructor to validate before fetching
**Warning signs:** Fetch throws TypeError on invalid URLs
**Code:**
```javascript
// Bad: no validation
if (input.startsWith('http')) {
  await fetch(input); // Throws on invalid URL
}

// Good: validate URL format
if (input.startsWith('http')) {
  try {
    new URL(input); // Throws if invalid
    await fetch(input);
  } catch (e) {
    displayError('Invalid URL format');
  }
}
```

### Pitfall 7: Not Handling Non-JSON Responses
**What goes wrong:** Calling .json() on HTML error page throws JSON parse error
**Why it happens:** Server returns HTML error instead of JSON, code assumes JSON response
**How to avoid:** Check Content-Type header before parsing
**Warning signs:** "Unexpected token < in JSON at position 0"
**Code:**
```javascript
// Bad: assumes JSON response
const data = await response.json(); // Throws if HTML

// Good: check Content-Type
const contentType = response.headers.get('Content-Type');
if (contentType && contentType.includes('application/json')) {
  const data = await response.json();
} else {
  throw new Error(`Expected JSON, got ${contentType}`);
}
```

## Code Examples

Verified patterns from official sources:

### Complete Fetch with Error Handling
```javascript
// Source: MDN + User CONTEXT.md requirements
// Fetch URL with 5s timeout, extract config, handle all error cases

async function fetchConfigFromUrl(url) {
  // Validate URL format
  try {
    new URL(url);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  // Fetch via CORS proxy with timeout
  const proxyUrl = `https://x402-proxy.example.workers.dev/?url=${encodeURIComponent(url)}`;

  let response;
  try {
    response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(5000)
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('Request timeout after 5 seconds — Check URL is reachable');
    }
    if (error.name === 'AbortError') {
      throw new Error('Request was cancelled');
    }
    throw new Error(`Network error: ${error.message}`);
  }

  // Check response status
  if (!response.ok && response.status !== 402) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  // Extract config from header or body
  const extraction = await extractX402Config(response);

  if (extraction.error) {
    throw new Error(extraction.error);
  }

  return {
    config: extraction.config,
    source: extraction.source,
    warning: extraction.warning,
    status: extraction.status
  };
}
```

### Cloudflare Worker with Security
```javascript
// Source: https://developers.cloudflare.com/workers/examples/cors-header-proxy/
// Cloudflare Worker with Origin validation and proper error handling

export default {
  async fetch(request) {
    // Only allow from specific origins
    const origin = request.headers.get('Origin');
    const allowedOrigins = [
      'https://x402check.example.com',
      'http://localhost:8000'
    ];

    if (origin && !allowedOrigins.includes(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // Extract target URL
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing ?url= parameter', { status: 400 });
    }

    // Validate target URL format
    try {
      new URL(targetUrl);
    } catch (e) {
      return new Response('Invalid target URL', { status: 400 });
    }

    // Fetch from target
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          'User-Agent': 'x402check/1.0'
        }
      });

      // Clone and add CORS headers
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

      newResponse.headers.set('Access-Control-Allow-Origin', origin || '*');
      newResponse.headers.set('Access-Control-Expose-Headers', 'PAYMENT-REQUIRED, X-Payment');

      return newResponse;

    } catch (error) {
      return new Response(`Proxy error: ${error.message}`, { status: 502 });
    }
  }
};
```

### Input Detection and Auto-Format JSON
```javascript
// Source: User CONTEXT.md + MDN JSON.stringify
// Detect input type and auto-format JSON on paste

const input = document.querySelector('textarea');

input.addEventListener('paste', (event) => {
  // Let paste happen first
  setTimeout(() => {
    const value = input.value.trim();

    // If not a URL, try to format as JSON
    if (!value.startsWith('http://') && !value.startsWith('https://')) {
      try {
        const parsed = JSON.parse(value);
        const formatted = JSON.stringify(parsed, null, 2);
        input.value = formatted;
      } catch (e) {
        // Not valid JSON, show inline hint
        input.classList.add('invalid-json');
      }
    }
  }, 10);
});

input.addEventListener('input', () => {
  // Clear invalid state when user edits
  input.classList.remove('invalid-json');

  // Detect if URL for potential styling
  const value = input.value.trim();
  if (value.startsWith('http://') || value.startsWith('https://')) {
    input.classList.add('url-mode');
  } else {
    input.classList.remove('url-mode');
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| X-Payment custom header | PAYMENT-REQUIRED standard header | x402 v2 (Jan 2026) | Must check PAYMENT-REQUIRED first, X-Payment for legacy |
| Manual AbortController | AbortSignal.timeout() | Chrome 103 (July 2022) | Simpler API, automatic cleanup, no memory leaks |
| Promise.race for timeout | AbortSignal.timeout() | Chrome 103 (July 2022) | Avoids memory leak from unresolved Promises |
| Public CORS proxies | Cloudflare Workers | Workers GA (2020) | Free tier reliable, no third-party dependency |
| scrollHeight textarea | CSS Grid ::after technique | CSS Grid stable (2023) | No JavaScript, smoother animation |
| form-sizing CSS property | Experimental (Chrome Canary) | 2025+ | Future: native textarea auto-resize, not ready for production |

**Deprecated/outdated:**
- **X-Payment header:** x402 v2 uses PAYMENT-REQUIRED (but check both for compatibility)
- **cors-anywhere.herokuapp.com:** Shut down/rate-limited, unreliable for production
- **Promise.race timeout pattern:** Causes memory leaks, use AbortSignal.timeout() instead
- **XMLHttpRequest:** Use fetch API for all new code

## Open Questions

Things that couldn't be fully resolved:

1. **x402 v2 header encoding**
   - What we know: PAYMENT-REQUIRED header contains payment config (moved from body in v2)
   - What's unclear: Whether header value is base64-encoded JSON or plain JSON string
   - Recommendation: Try base64 decode first (atob), fallback to direct JSON.parse, handle both

2. **Browser support for AbortSignal.timeout()**
   - What we know: Chrome 103+, Firefox 100+, Safari 16+ support it
   - What's unclear: Whether to provide fallback for older browsers
   - Recommendation: Use modern approach, user context implies recent browser support acceptable

3. **Cloudflare Workers rate limit response**
   - What we know: Free tier has 100k requests/day limit
   - What's unclear: What error response is returned when limit exceeded
   - Recommendation: Display generic error, note: exceeding limit returns 429 Too Many Requests

4. **Input field starting state**
   - What we know: User wants single-line start, expands to multi-line for JSON
   - What's unclear: Exact CSS for smooth transition
   - Recommendation: Use CSS Grid ::after technique with min-height: 50px, max-height: 300px

## Sources

### Primary (HIGH confidence)
- [Cloudflare Workers CORS Proxy Example](https://developers.cloudflare.com/workers/examples/cors-header-proxy/) - Official implementation pattern
- [MDN: AbortSignal.timeout()](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/timeout_static) - Native timeout API
- [MDN: Response.headers.get()](https://developer.mozilla.org/en-US/docs/Web/API/Headers/get) - Header extraction
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/) - Free tier limits (100k requests/day)
- [Cloudflare Workers Get Started](https://developers.cloudflare.com/workers/get-started/guide/) - Wrangler CLI deployment
- [x402 Protocol (GitHub)](https://github.com/coinbase/x402) - Official protocol specification
- [x402 V2 Launch](https://www.x402.org/writing/x402-v2-launch) - Header-based config approach

### Secondary (MEDIUM confidence)
- [CSS-Tricks: Auto-Growing Textareas](https://css-tricks.com/the-cleanest-trick-for-autogrowing-textareas/) - CSS Grid ::after technique
- [JavaScript: Preventing Double Form Submission](https://www.the-art-of-web.com/javascript/doublesubmit/) - Disabled button pattern
- [CORS Proxies Safety](https://httptoolkit.com/blog/cors-proxies/) - Security considerations
- [Cloudflare: x402 Support](https://blog.cloudflare.com/x402/) - x402 integration announcement
- [Dmitri Pavlutin: Timeout Fetch](https://dmitripavlutin.com/timeout-fetch-request/) - Timeout patterns

### Tertiary (LOW confidence)
- [GitHub: AbortController Memory Leaks](https://github.com/nodejs/node/issues/52203) - Known issues (Node.js specific)
- [Medium: AbortController Guide](https://medium.com/@amitazadi/the-complete-guide-to-abortcontroller-and-abortsignal-from-basics-to-advanced-patterns-a3961753ef54) - Comprehensive patterns
- [Loading.io Button Spinners](https://loading.io/button/) - CSS-only loading states

### Key Research Notes
- **AbortSignal.timeout()**: High confidence—official MDN docs, browser support verified (2022+)
- **Cloudflare Workers**: High confidence—official docs, free tier limits confirmed, deployment steps clear
- **x402 v2 headers**: Medium confidence—official announcement found, but exact header encoding not fully documented
- **CORS proxy security**: High confidence—multiple sources agree on Origin validation necessity
- **CSS Grid textarea**: Medium confidence—widely documented technique, not "official" but well-established

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Fetch API and Cloudflare Workers are well-established, docs complete
- Architecture: HIGH - Patterns are standard (smart detection, disabled buttons, CORS proxy)
- Pitfalls: HIGH - AbortController leaks, open proxy abuse, button re-enable are well-documented
- x402 header details: MEDIUM - v2 spec clear on header-first approach, encoding details unclear

**Research date:** 2026-01-22
**Valid until:** ~30 days (Feb 2026) for implementation patterns; x402 spec is stable v2 as of Jan 2026

**Research gaps addressed:**
- ✅ Smart input detection (URL vs JSON without tabs)
- ✅ Cloudflare Workers proxy setup and security
- ✅ Fetch timeout with AbortSignal.timeout()
- ✅ X-Payment / PAYMENT-REQUIRED header extraction
- ✅ Loading state patterns (disabled button, spinner)
- ⚠️ x402 v2 header encoding (atob base64 vs plain JSON—handle both)

**Critical for planner:**
- Single input field with `.startsWith('http')` detection (user decision)
- 5 second timeout for URL fetches (user decision)
- Header priority: PAYMENT-REQUIRED > response body (user decision)
- Always disable button during fetch to prevent double-submit
- Cloudflare Worker MUST validate Origin header (security critical)
- Use AbortSignal.timeout() not manual AbortController (memory leak prevention)
