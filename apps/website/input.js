/**
 * x402 Input Handler v3
 *
 * Smart input detection, URL testing with checklist, config extraction.
 * Adapter layer: maps SDK validate() to old website API shape.
 */

const PROXY_URL = 'https://x402-proxy.mail-753.workers.dev';
const FETCH_TIMEOUT_MS = 10000;

// ── CAIP-2 Reverse Lookup ──────────────────────────────────────────────────
// Maps SDK CAIP-2 network identifiers back to simple display names
const CAIP2_TO_SIMPLE = {
  'eip155:8453': 'base',
  'eip155:84532': 'base-sepolia',
  'eip155:43114': 'avalanche',
  'eip155:43113': 'avalanche-fuji',
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'solana',
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': 'solana-devnet',
  'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z': 'solana-testnet',
  'stellar:pubnet': 'stellar',
  'stellar:testnet': 'stellar-testnet',
  'aptos:1': 'aptos',
  'aptos:2': 'aptos-testnet',
};

// ── Amount Normalization (display helper) ──────────────────────────────────
// Moved from validator.js. Converts atomic/micro-unit amounts for display.
function normalizeAmount(value) {
  if (value === undefined || value === null) {
    return { normalized: null, original: value, isMicroUnits: false };
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return { normalized: null, original: value, isMicroUnits: false, error: 'Invalid number' };
  }

  // Heuristic: if > 1000, assume micro-units (divide by 1,000,000)
  const isMicroUnits = num > 1000;
  const normalized = isMicroUnits ? num / 1_000_000 : num;

  return {
    normalized,
    original: value,
    isMicroUnits,
    microUnits: isMicroUnits ? num : Math.round(normalized * 1_000_000)
  };
}

// ── SDK Adapter ────────────────────────────────────────────────────────────
// Maps window.x402Validate.validate() output to the old validator shape
// that the display logic (renderVerdict, renderDetails) expects.

/**
 * Adapter: validates config via SDK and maps result to old website API shape.
 * Called by handleValidation() and testX402Url() -- preserves all existing flows.
 *
 * @param {string|object} configText - JSON string or parsed config object
 * @returns {{ valid, errors, warnings, detectedFormat, normalized }}
 */
function validateX402Config(configText) {
  try {
    const sdkResult = window.x402Validate.validate(configText);

    return {
      valid: sdkResult.valid,
      errors: sdkResult.errors.map(e => ({
        field: e.field,
        message: e.message,
        fix: e.fix || undefined
      })),
      warnings: sdkResult.warnings.map(w => ({
        field: w.field,
        message: w.message,
        fix: w.fix || undefined
      })),
      detectedFormat: mapVersionToFormat(sdkResult.version, sdkResult.normalized),
      normalized: adaptNormalized(sdkResult.normalized)
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ field: 'root', message: error.message }],
      warnings: [],
      detectedFormat: 'unknown',
      normalized: null
    };
  }
}

/**
 * Map SDK version string to old format label.
 * Also checks for marketplace extensions to preserve v2-marketplace badge.
 */
function mapVersionToFormat(version, normalized) {
  if (version === 'v2' && normalized && normalized.extensions) {
    const ext = normalized.extensions;
    if (ext.metadata || ext.outputSchema || ext.inputSchema) {
      return 'v2-marketplace';
    }
  }

  const map = {
    'v2': 'v2',
    'v1': 'v1',
    'unknown': 'unknown'
  };
  return map[version] || 'unknown';
}

/**
 * Adapt SDK NormalizedConfig (accepts[] with CAIP-2 networks) to old shape
 * (payments[] with simple chain names).
 */
function adaptNormalized(sdkNormalized) {
  if (!sdkNormalized || !sdkNormalized.accepts) return null;

  return {
    x402Version: sdkNormalized.x402Version,
    payments: sdkNormalized.accepts.map(accept => ({
      chain: CAIP2_TO_SIMPLE[accept.network] || accept.network,
      address: accept.payTo,
      asset: accept.asset,
      minAmount: accept.amount,
      _normalizedAmount: normalizeAmount(accept.amount)
    })),
    metadata: sdkNormalized.extensions?.metadata,
    outputSchema: sdkNormalized.extensions?.outputSchema
  };
}

// ── Input Detection ────────────────────────────────────────────────────────

/**
 * Detect input type based on content
 */
function detectInputType(input) {
  const trimmed = input.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return 'url';
  }
  return 'json';
}

// ── URL Testing ────────────────────────────────────────────────────────────

/**
 * Test a URL and return checklist results
 */
async function testX402Url(url, method = 'GET', body = null) {
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    throw new Error('Invalid URL format');
  }

  const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}&method=${encodeURIComponent(method)}`;

  let response;
  try {
    response = await fetch(proxyUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
    });
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error('Request timeout - endpoint may be unreachable');
    }
    throw new Error(`Network error: ${error.message}`);
  }

  // Build checklist
  const checks = {
    returns402: {
      pass: response.status === 402,
      label: 'Returns 402',
      detail: response.status === 402 ? null : `Returned ${response.status}`
    },
    hasConfig: {
      pass: false,
      label: 'Valid payment config',
      detail: null
    },
    hasHeader: {
      pass: !!response.headers.get('PAYMENT-REQUIRED'),
      label: 'PAYMENT-REQUIRED header',
      detail: response.headers.get('PAYMENT-REQUIRED') ? 'Present (base64)' : 'Not present (optional)'
    },
    hasCors: {
      pass: true, // If we got here through proxy, CORS is handled
      label: 'CORS accessible',
      detail: 'Via proxy'
    }
  };

  // Always read response body
  let rawBody = null;
  try {
    rawBody = await response.text();
  } catch (e) {
    console.log('Failed to read body:', e.message);
  }

  // Try to extract config
  let config = null;
  let configSource = null;

  // Priority 1: PAYMENT-REQUIRED header
  const paymentHeader = response.headers.get('PAYMENT-REQUIRED');
  if (paymentHeader) {
    try {
      const decoded = atob(paymentHeader);
      config = JSON.parse(decoded);
      configSource = 'PAYMENT-REQUIRED header';
    } catch (e) {
      try {
        config = JSON.parse(paymentHeader);
        configSource = 'PAYMENT-REQUIRED header (raw JSON)';
      } catch (e2) {
        // Header exists but invalid
      }
    }
  }

  // Priority 2: Response body
  if (!config && rawBody && rawBody.trim()) {
    try {
      config = JSON.parse(rawBody);
      configSource = 'response body';
    } catch (e) {
      // Not valid JSON
    }
  }

  if (config) {
    checks.hasConfig.pass = true;
    checks.hasConfig.detail = `Found in ${configSource}`;
  } else {
    checks.hasConfig.detail = 'No valid JSON config found';
  }

  // Validate if we have config
  let validation = null;
  if (config) {
    try {
      validation = validateX402Config(config);

      // Add format check
      if (validation && validation.detectedFormat) {
        checks.formatCheck = {
          pass: validation.detectedFormat === 'v2' || validation.detectedFormat === 'v2-marketplace',
          label: 'Using v2 format',
          detail: validation.detectedFormat === 'v2' || validation.detectedFormat === 'v2-marketplace'
            ? 'Canonical format'
            : `Using ${validation.detectedFormat} format`
        };
      }
    } catch (e) {
      console.error('Validation error:', e);
      // validation stays null
    }
  }

  return {
    checks,
    config,
    configSource,
    validation,
    rawBody,
    status: response.status,
    method,
    url
  };
}

// ── Main Handler ───────────────────────────────────────────────────────────

/**
 * Main handler for validation
 */
async function handleValidation(inputValue, method, displayResultsFn, displayErrorFn) {
  const inputType = detectInputType(inputValue);

  try {
    if (inputType === 'url') {
      const result = await testX402Url(inputValue, method);
      displayResultsFn({
        type: 'url',
        ...result
      });
    } else {
      const validation = validateX402Config(inputValue);
      displayResultsFn({
        type: 'json',
        validation,
        config: validation.normalized
      });
    }
  } catch (error) {
    displayErrorFn(error.message);
  }
}

/**
 * Format JSON for display
 */
function formatJsonForDisplay(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    return jsonString;
  }
}
