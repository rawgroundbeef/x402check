import { defineConfig } from 'tsdown'

export default defineConfig([
  // ESM + CJS for Node.js and bundlers
  {
    entry: ['./src/index.ts'],
    format: ['esm', 'cjs'],
    platform: 'neutral',
    dts: true,
    sourcemap: true,
    minify: false,
    clean: true,
    outDir: 'dist',
    external: [],
  },
  // UMD/IIFE for browser script tag
  {
    entry: ['./src/index.ts'],
    format: ['iife'],
    platform: 'browser',
    globalName: 'x402Validate',
    target: ['es2020'],
    minify: true,
    sourcemap: false,
    dts: false,
    clean: false,
    outDir: 'dist',
    external: [],
  },
  // CLI binary
  {
    entry: ['./src/cli.ts'],
    format: ['esm'],
    platform: 'node',
    banner: { js: '#!/usr/bin/env node' },
    dts: false,
    sourcemap: false,
    minify: false,
    clean: false,
    outDir: 'dist',
    external: [],
  },
])
