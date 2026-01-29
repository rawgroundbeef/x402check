/**
 * x402 Input Handler v2
 *
 * Smart input detection, URL testing with checklist, config extraction.
 */

const PROXY_URL = 'https://x402-proxy.mail-753.workers.dev';
const FETCH_TIMEOUT_MS = 10000;

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

  // Priority 2: Response body - always try to read and parse
  if (!config) {
    try {
      const bodyText = await response.text();
      if (bodyText && bodyText.trim()) {
        config = JSON.parse(bodyText);
        configSource = 'response body';
      }
    } catch (e) {
      // Not valid JSON - that's ok, config stays null
      console.log('Body parse failed:', e.message);
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
    status: response.status,
    method,
    url
  };
}

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
