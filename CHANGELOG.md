# Changelog

All notable changes to the `valuethen` package. Versions follow [Semantic Versioning](https://semver.org/).

## 1.3.0

The API gained monthly figures, gold and silver, a `cpi` method and a sandbox, and dropped series exports and PPP. This release catches up.

### Added

- **Monthly precision.** `convert()` and `inflate()` take `fromMonth` and `toMonth`; the CLI accepts `YYYY-MM` for both years (`valuethen convert 100 USD 1990-03 USD 2025-06`). A month on one side only is caught locally. Where a currency has no monthly index the API falls back to annual averages and says so in `note`.
- `series(currency, { freq: 'monthly' })` and `valuethen series <currency> --monthly`.
- **Gold and silver.** `metals('XAU' | 'XAG', { year })` and `valuethen metals <XAU|XAG> [year]`, for observed prices per troy ounce. `XAU` and `XAG` also work in `convert`.
- `method: 'cpi'` and `--method`: compares the price change in both currencies without exchanging money. The CLI then shows the result in the starting currency and both changes.
- `sandboxConvert()`: fixed sample data in production shapes, unmetered, for building and testing integrations.
- `valuethen coverage` shows each currency's monthly range when it has one.
- Types for `frequency`, `methods`, `units`, `coverage` and `computedAt` on results, monthly series, metals and batch results.
- A weekly CI check of the SDK against the live OpenAPI description, and a release workflow that publishes to npm with provenance.

### Deprecated

- `createSeriesExport()` and `job()`. The API no longer has these routes and answers 404; call `series()` per currency instead. They will be removed in 2.0.
- `method: 'ppp'`. The API answers `method_unavailable` until it can validate PPP factors.

### Changed

- `Coverage.cpiFrom` and `cpiTo` are typed `number | null`: currencies with exchange rates but no price index return null.
- `convertBatch()` is typed as returning `BatchResult`.
- CI tests Node 18, 22 and 24. Node 20 is past end of life.

## 1.2.0 — 2026-10-08

### Fixed

- **CLI options work anywhere.** A flag such as `--json` used to swallow the next argument, so `valuethen convert --json 100 USD 1970` failed. Options are now parsed with `util.parseArgs`.
- **`-h` works.** It was reported as an unknown command.
- **Bad input is caught locally.** Non-numeric amounts and years were sent to the API as `NaN`; amounts, currency codes and years are now checked first, with a clear message.
- **Browsers.** The default `fetch` was called as a method of the client, which browsers reject with "Illegal invocation".

### Added

- Request timeout: `timeout` option (default 30 s) and `--timeout`. A timed-out request fails with code `timeout`.
- `retries` option: retries 429, 502, 503, 504 and network failures, honouring `Retry-After` up to 60 s. POSTs are retried only with an idempotency key.
- `ValueThenError.retryAfter`, and `rate_limited` as the code for a 429 without a problem body.
- `-v` / `--version`, and `VALUETHEN_API_KEY` as an alternative to `--api-key`.
- TypeScript types.
- Exports `VERSION` and `parseRetryAfter`.
- Licence text, tests on Node 18, 20 and 22, and a security policy.

### Changed

- The CLI exits with code 2, not 1, when the command itself is not valid.
- Requires Node.js 18.3 or newer.
- `plugin.json` now carries the package version.

## 1.1.0 — 2026-09-02

- The CLI prints a link to the same calculation on valuethen.com (`attribution.canonicalUrl`).
- Agent Plugin layout: `plugin.json` manifest, `mcp.json` with both MCP servers, and `skills/valuethen/SKILL.md`.

## 1.0.0 — 2026-09-02

- First release: the `valuethen` CLI (`convert`, `inflate`, `series`, `coverage`) and SDK.
