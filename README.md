# x402check

Validate [x402](https://www.x402.org/) payment configurations. Checks structure, address formats, network identifiers, and more — with zero dependencies.

**[x402check.com](https://www.x402check.com)** — validate in the browser
**[npm](https://www.npmjs.com/package/x402check)** — `npm i x402check`

## What it does

- Validates v1 and v2 x402 payment configs
- Verifies EVM addresses (EIP-55 checksums) and Solana addresses (base58)
- Checks CAIP-2 network identifiers against a known registry
- Extracts configs from HTTP 402 responses (body or `PAYMENT-REQUIRED` header)
- Normalizes any supported format to canonical v2
- Returns structured errors and warnings with fix suggestions

## Monorepo structure

```
packages/
  x402check/      SDK — published to npm as x402check
  config/         Shared TypeScript config
apps/
  website/        x402check.com — hosted on Cloudflare Pages
    worker/       CORS proxy — Cloudflare Worker
```

## Development

```bash
pnpm install
pnpm build:sdk
pnpm test:sdk
```

## Links

- [x402 protocol](https://www.x402.org/)
- [x402check.com](https://www.x402check.com)
- [npm package](https://www.npmjs.com/package/x402check)

## License

MIT
