import { describe, it, expect } from 'vitest'
import { VERSION } from '../src/index'

describe('x402check package', () => {
  it('exports VERSION constant', () => {
    expect(VERSION).toBe('0.1.0')
  })

  it('exports are defined', async () => {
    const mod = await import('../src/index')
    expect(mod).toBeDefined()
    expect(typeof mod).toBe('object')
  })
})
