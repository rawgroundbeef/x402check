/**
 * CLI argument parsing
 *
 * Parses command-line arguments using Node's util.parseArgs API.
 * Supports repeatable --header flags for custom HTTP headers.
 */

import { parseArgs } from 'node:util'

/**
 * Parsed CLI arguments
 */
export interface CliArgs {
  input: string | null
  strict: boolean
  json: boolean
  quiet: boolean
  help: boolean
  version: boolean
  headers: Record<string, string>
}

/**
 * Parse CLI arguments from argv array
 *
 * @param argv - Command-line arguments (typically process.argv.slice(2))
 * @returns Parsed CliArgs object
 *
 * Example:
 *   parseCliArgs(['config.json', '--strict', '--header', 'Authorization: Bearer xyz'])
 *   // => { input: 'config.json', strict: true, headers: { Authorization: 'Bearer xyz' }, ... }
 */
export function parseCliArgs(argv: string[]): CliArgs {
  const parsed = parseArgs({
    args: argv,
    options: {
      strict: { type: 'boolean' },
      json: { type: 'boolean' },
      quiet: { type: 'boolean', short: 'q' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
      header: { type: 'string', multiple: true },
    },
    allowPositionals: true,
  })

  // Parse --header flags into Record
  const headers: Record<string, string> = {}
  const headerValues = parsed.values.header
  if (Array.isArray(headerValues)) {
    for (const headerStr of headerValues) {
      const colonIndex = headerStr.indexOf(':')
      if (colonIndex === -1) {
        // Invalid header format - skip it (or could throw)
        continue
      }
      const key = headerStr.slice(0, colonIndex).trim()
      const value = headerStr.slice(colonIndex + 1).trim()
      if (key) {
        headers[key] = value
      }
    }
  }

  return {
    input: parsed.positionals[0] ?? null,
    strict: parsed.values.strict ?? false,
    json: parsed.values.json ?? false,
    quiet: parsed.values.quiet ?? false,
    help: parsed.values.help ?? false,
    version: parsed.values.version ?? false,
    headers,
  }
}
