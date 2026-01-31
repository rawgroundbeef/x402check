/**
 * x402check CLI
 *
 * Validate x402 payment configurations from the command line.
 *
 * Usage:
 *   x402check <json>              Validate inline JSON
 *   x402check <file.json>         Validate a JSON file
 *   x402check <url>               Fetch URL, extract + validate 402 config
 *   echo '{}' | x402check         Validate from stdin
 *   x402check --version            Print version
 *   x402check --help               Print help
 *
 * Flags:
 *   --strict                       Promote all warnings to errors
 *   --json                         Output raw JSON (for piping)
 *   --quiet                        Only print errors (exit code only)
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { validate } from './validation/orchestrator'
import { check } from './check'
import { VERSION } from './index'
import type { ValidationResult } from './types/validation'
import type { CheckResult } from './types/check'
import type { ValidationIssue } from './types/validation'

// ── Arg parsing ──────────────────────────────────────────────────────────

interface CliArgs {
  input: string | null
  strict: boolean
  json: boolean
  quiet: boolean
  help: boolean
  version: boolean
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    input: null,
    strict: false,
    json: false,
    quiet: false,
    help: false,
    version: false,
  }

  for (const arg of argv) {
    if (arg === '--strict') args.strict = true
    else if (arg === '--json') args.json = true
    else if (arg === '--quiet' || arg === '-q') args.quiet = true
    else if (arg === '--help' || arg === '-h') args.help = true
    else if (arg === '--version' || arg === '-v') args.version = true
    else if (!arg.startsWith('-')) args.input = arg
  }

  return args
}

// ── Help text ────────────────────────────────────────────────────────────

const HELP = `x402check v${VERSION} — validate x402 payment configurations

Usage:
  x402check <json>              Validate inline JSON string
  x402check <file.json>         Validate a JSON file
  x402check <url>               Fetch URL and check 402 response
  echo '...' | x402check        Validate from stdin

Flags:
  --strict     Promote all warnings to errors
  --json       Output raw JSON result
  --quiet      Suppress output, exit code only
  -h, --help   Show this help
  -v, --version  Show version

Exit codes:
  0  Valid config (or --help/--version)
  1  Invalid config or errors found
  2  Input error (no input, bad file, fetch failure)

Examples:
  x402check '{"x402Version":2,"accepts":[...]}'
  x402check config.json
  x402check https://api.example.com/resource --strict
  curl -s https://example.com | x402check --json
`

// ── Input resolution ─────────────────────────────────────────────────────

function isUrl(s: string): boolean {
  return /^https?:\/\//i.test(s)
}

function isJsonLike(s: string): boolean {
  const trimmed = s.trim()
  return trimmed.startsWith('{') || trimmed.startsWith('[')
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    const { stdin } = process

    // If stdin is a TTY (no pipe), return empty
    if (stdin.isTTY) {
      resolve('')
      return
    }

    stdin.on('data', (chunk: Buffer) => chunks.push(chunk))
    stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    stdin.on('error', reject)
  })
}

async function fetchUrl(url: string): Promise<{ status: number; body: unknown; headers: Record<string, string> }> {
  const res = await fetch(url)
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

  return { status: res.status, body, headers }
}

// ── Formatting ───────────────────────────────────────────────────────────

function formatIssue(issue: ValidationIssue): string {
  const icon = issue.severity === 'error' ? '\x1b[31m✗\x1b[0m' : '\x1b[33m⚠\x1b[0m'
  const line = `  ${icon} ${issue.code} [${issue.field}]: ${issue.message}`
  if (issue.fix) {
    return line + `\n      ↳ ${issue.fix}`
  }
  return line
}

function formatValidationResult(result: ValidationResult, args: CliArgs): string {
  if (args.json) return JSON.stringify(result, null, 2)
  if (args.quiet) return ''

  const lines: string[] = []

  // Status line
  if (result.valid) {
    lines.push(`\x1b[32m✓ Valid\x1b[0m x402 config (${result.version})`)
  } else {
    lines.push(`\x1b[31m✗ Invalid\x1b[0m x402 config (${result.version})`)
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('')
    lines.push(`Errors (${result.errors.length}):`)
    for (const e of result.errors) lines.push(formatIssue(e))
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('')
    lines.push(`Warnings (${result.warnings.length}):`)
    for (const w of result.warnings) lines.push(formatIssue(w))
  }

  return lines.join('\n')
}

function formatCheckResult(result: CheckResult, args: CliArgs): string {
  if (args.json) return JSON.stringify(result, null, 2)
  if (args.quiet) return ''

  const lines: string[] = []

  // Extraction status
  if (!result.extracted) {
    lines.push(`\x1b[31m✗ No x402 config found\x1b[0m`)
    if (result.extractionError) {
      lines.push(`  ${result.extractionError}`)
    }
    return lines.join('\n')
  }

  lines.push(`Extracted from: ${result.source}`)

  // Validation status
  if (result.valid) {
    lines.push(`\x1b[32m✓ Valid\x1b[0m x402 config (${result.version})`)
  } else {
    lines.push(`\x1b[31m✗ Invalid\x1b[0m x402 config (${result.version})`)
  }

  // Summary
  if (result.summary.length > 0) {
    lines.push('')
    lines.push('Payment options:')
    for (const s of result.summary) {
      const symbol = s.assetSymbol ?? s.asset
      const net = s.networkName
      lines.push(`  [${s.index}] ${s.amount} ${symbol} on ${net} → ${s.payTo.slice(0, 10)}...`)
    }
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push('')
    lines.push(`Errors (${result.errors.length}):`)
    for (const e of result.errors) lines.push(formatIssue(e))
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('')
    lines.push(`Warnings (${result.warnings.length}):`)
    for (const w of result.warnings) lines.push(formatIssue(w))
  }

  return lines.join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2))

  if (args.version) {
    console.log(VERSION)
    return 0
  }

  if (args.help) {
    console.log(HELP)
    return 0
  }

  // Resolve input
  let input: string | null = args.input

  // Try stdin if no positional arg
  if (!input) {
    const stdinData = await readStdin()
    if (stdinData.trim()) {
      input = stdinData.trim()
    }
  }

  if (!input) {
    console.error('No input provided. Run x402check --help for usage.')
    return 2
  }

  // URL mode → fetch + check()
  if (isUrl(input)) {
    try {
      const { status, body, headers } = await fetchUrl(input)

      if (status !== 402) {
        if (!args.quiet) {
          console.log(`HTTP ${status} (expected 402)`)
        }
      }

      const result = check({ body, headers }, { strict: args.strict })
      const output = formatCheckResult(result, args)
      if (output) console.log(output)
      return result.valid ? 0 : 1
    } catch (err) {
      console.error(`Fetch failed: ${(err as Error).message}`)
      return 2
    }
  }

  // File mode → read file + validate()
  if (!isJsonLike(input)) {
    const filePath = resolve(input)
    if (!existsSync(filePath)) {
      console.error(`File not found: ${filePath}`)
      return 2
    }

    try {
      input = readFileSync(filePath, 'utf-8')
    } catch (err) {
      console.error(`Cannot read file: ${(err as Error).message}`)
      return 2
    }
  }

  // JSON mode → validate()
  const result = validate(input, { strict: args.strict })
  const output = formatValidationResult(result, args)
  if (output) console.log(output)
  return result.valid ? 0 : 1
}

main().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`Unexpected error: ${(err as Error).message}`)
    process.exit(2)
  },
)
