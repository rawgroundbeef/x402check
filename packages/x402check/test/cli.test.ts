import { describe, test, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const CLI = resolve(__dirname, '../dist/cli.mjs')
const FIXTURES = resolve(__dirname, 'fixtures')

/** Run the CLI and return { stdout, stderr, exitCode } */
function run(args: string[], opts?: { input?: string }): {
  stdout: string
  stderr: string
  exitCode: number
} {
  try {
    const stdout = execFileSync('node', [CLI, ...args], {
      encoding: 'utf-8',
      input: opts?.input,
      timeout: 10_000,
    })
    return { stdout, stderr: '', exitCode: 0 }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; status?: number }
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: e.status ?? 1,
    }
  }
}

describe('cli --version', () => {
  test('prints version and exits 0', () => {
    const { stdout, exitCode } = run(['--version'])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test('-v also works', () => {
    const { stdout, exitCode } = run(['-v'])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('cli --help', () => {
  test('prints help text and exits 0', () => {
    const { stdout, exitCode } = run(['--help'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('x402check')
    expect(stdout).toContain('Usage:')
    expect(stdout).toContain('Flags:')
    expect(stdout).toContain('Exit codes:')
  })

  test('-h also works', () => {
    const { stdout, exitCode } = run(['-h'])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Usage:')
  })
})

describe('cli with no input', () => {
  test('prints error and exits 2', () => {
    const { stderr, exitCode } = run([])
    expect(exitCode).toBe(2)
    expect(stderr).toContain('No input provided')
  })
})

describe('cli — file input', () => {
  test('valid v2 fixture: exits 0, prints Valid', () => {
    const { stdout, exitCode } = run([resolve(FIXTURES, 'valid-v2-base.json')])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Valid')
  })

  test('valid v1 fixture: exits 0, prints Valid with warnings', () => {
    const { stdout, exitCode } = run([resolve(FIXTURES, 'valid-v1.json')])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Valid')
    expect(stdout).toContain('LEGACY_FORMAT')
  })

  test('nonexistent file: exits 2', () => {
    const { stderr, exitCode } = run(['nonexistent-file-12345.json'])
    expect(exitCode).toBe(2)
    expect(stderr).toContain('File not found')
  })
})

describe('cli — inline JSON', () => {
  test('valid inline JSON: exits 0', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        maxTimeoutSeconds: 60,
      }],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run([json])
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Valid')
  })

  test('invalid inline JSON (empty accepts): exits 1', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run([json])
    expect(exitCode).toBe(1)
    expect(stdout).toContain('Invalid')
    expect(stdout).toContain('EMPTY_ACCEPTS')
  })

  test('malformed JSON: exits 1', () => {
    const { stdout, exitCode } = run(['{not valid json'])
    // This starts with { so it's treated as JSON-like, then validate() parses it
    expect(exitCode).toBe(1)
  })
})

describe('cli — stdin input', () => {
  test('valid JSON from stdin: exits 0', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
        maxTimeoutSeconds: 60,
      }],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run([], { input: json })
    expect(exitCode).toBe(0)
    expect(stdout).toContain('Valid')
  })
})

describe('cli — --json flag', () => {
  test('outputs valid JSON', () => {
    const { stdout, exitCode } = run(['--json', resolve(FIXTURES, 'valid-v2-base.json')])
    expect(exitCode).toBe(0)
    const parsed = JSON.parse(stdout)
    expect(parsed.valid).toBe(true)
    expect(parsed.version).toBe('v2')
    expect(Array.isArray(parsed.errors)).toBe(true)
    expect(Array.isArray(parsed.warnings)).toBe(true)
  })

  test('outputs valid JSON for invalid config too', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run(['--json', json])
    expect(exitCode).toBe(1)
    const parsed = JSON.parse(stdout)
    expect(parsed.valid).toBe(false)
    expect(parsed.errors.length).toBeGreaterThan(0)
  })
})

describe('cli — --quiet flag', () => {
  test('no output on valid config, exits 0', () => {
    const { stdout, exitCode } = run(['--quiet', resolve(FIXTURES, 'valid-v2-base.json')])
    expect(exitCode).toBe(0)
    expect(stdout.trim()).toBe('')
  })

  test('no output on invalid config, exits 1', () => {
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [],
      resource: { url: 'https://example.com' },
    })
    const { stdout, exitCode } = run(['--quiet', json])
    expect(exitCode).toBe(1)
    expect(stdout.trim()).toBe('')
  })
})

describe('cli — --strict flag', () => {
  test('warnings promoted to errors, exits 1', () => {
    // Config that is valid normally but has warnings
    const json = JSON.stringify({
      x402Version: 2,
      accepts: [{
        scheme: 'exact',
        network: 'eip155:8453',
        amount: '1000000',
        asset: '0x0000000000000000000000000000000000000001',
        payTo: '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
      }],
    })

    // Normal: valid with warnings
    const normal = run([json])
    expect(normal.exitCode).toBe(0)

    // Strict: warnings become errors
    const strict = run(['--strict', json])
    expect(strict.exitCode).toBe(1)
  })
})
