# Contributing to ai-sdk-otel-adapter

The mapping table in `src/mapping.ts` is the source of truth. Adding a new attribute mapping is a one-line change — no framework knowledge required.

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/ai-sdk-otel-adapter.git
cd ai-sdk-otel-adapter
npm install
npm test
```

## Adding a new mapping

1. Open `src/mapping.ts`
2. Add your `'ai.*': 'gen_ai.*'` entry to `ATTRIBUTE_MAP`
3. If the attribute needs value transformation (like provider normalization), add handling in `src/index.ts`
4. Add a test case in `test/processor.test.ts`
5. Run `npm test` to verify
6. Open a PR

## Adding a new provider

Add a new entry to `PROVIDER_MAP` in `src/mapping.ts`:

```typescript
{ pattern: /^your-provider\b/i, system: 'otel_system_name' },
```

## Running tests

```bash
npm test          # run once
npx vitest        # watch mode
```

## Building

```bash
npm run build
```

Output goes to `dist/` — ESM, CJS, and type declarations.

## Guidelines

- Keep `src/mapping.ts` as a pure data file where possible
- Don't add runtime dependencies — this package must stay zero-dep
- Every mapping needs a corresponding test case
- Match the OTel GenAI semantic conventions spec for target attribute names
