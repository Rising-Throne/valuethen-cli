# Changelog

All notable changes to the `valuethen` package. Versions follow [Semantic Versioning](https://semver.org/).

## 1.2.0

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
