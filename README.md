# valuethen

[![npm](https://img.shields.io/npm/v/valuethen)](https://www.npmjs.com/package/valuethen)
[![CI](https://github.com/Rising-Throne/valuethen-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Rising-Throne/valuethen-cli/actions/workflows/ci.yml)
[![Node](https://img.shields.io/node/v/valuethen)](package.json)
[![Licence: MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)

CLI and SDK for the free [ValueThen](https://valuethen.com) purchasing-power API. Convert an amount of money from one year into what it is worth in another, in the same currency or a different one, using official consumer price indices and central-bank exchange rates.

No API key. No sign-up. No dependencies. TypeScript types included.

```console
$ npx valuethen convert 100 USD 1970
$100.00 in 1970  =  $829.22 in 2025
Price change: +729.2%
Sources: World Bank FP.CPI.TOTL, 2010=100; recent complete years chained from CPI-U (FRED CPIAUCNS)
Open this calculation: https://valuethen.com/?a=100&f=USD&fy=1970&t=USD&ty=2025
```

## Install

```bash
npm install valuethen        # SDK
npm install -g valuethen     # CLI on your PATH
npx valuethen --help         # or run it without installing
```

Requires Node.js 18.3 or newer. The SDK uses only standard web APIs (`fetch`, `URL`, `AbortController`), so it also runs in Deno, Bun and edge runtimes.

## CLI

```text
valuethen convert <amount> <from> <fromYear> [to] [toYear]   Convert across years and currencies
valuethen inflate <amount> <currency> <fromYear> [toYear]    Same-currency inflation adjustment
valuethen series <currency>                                  Full price index series
valuethen metals <XAU|XAG> [year]                            Gold or silver price per troy ounce
valuethen coverage                                           Every currency and its data range
```

| Option | What it does |
| --- | --- |
| `--json` | Print the raw API response |
| `--method NAME` | `convert` only: `cpi-then-fx` (default), `fx-then-cpi` or `cpi` |
| `--monthly` | `series` only: the monthly index instead of the annual one |
| `--api-key KEY` | Send an API key for higher rate limits. `VALUETHEN_API_KEY` works too |
| `--base URL` | Point at another API deployment |
| `--timeout SECS` | Give up after this many seconds (default 30) |
| `-h`, `--help` | Show help |
| `-v`, `--version` | Show the version |

Options can go anywhere in the command. `to` defaults to the starting currency, and `toYear` to the latest year both currencies cover.

A year can carry a month, written `YYYY-MM`, to use monthly price indices. Give a month for both years or for neither. Where a currency has no monthly index, the API uses annual averages and says so in a note.

```bash
valuethen convert 100 USD 1970 EUR 2024        # cross-currency
valuethen convert 100 USD 1990-03 USD 2025-06  # month to month
valuethen convert 100 USD 2000 EUR --method cpi # compare price changes, no exchange
valuethen convert 1 XAU 1900 USD               # an ounce of gold from 1900, in today's dollars
valuethen metals XAU 1900                      # the observed gold price that year
valuethen inflate 1000 TRY 1990 --json | jq .result
valuethen --json series GBP > gbp.json
```

**Exit codes:** `0` success, `1` the request failed (the API's error code is printed), `2` the command itself was not valid. Amounts, currency codes and years are checked before anything is sent.

## SDK

```js
import { ValueThen, ValueThenError } from 'valuethen';

const client = new ValueThen();

const answer = await client.convert({ amount: 100, from: 'USD', to: 'EUR', fromYear: 1970, toYear: 2024 });
console.log(answer.result, answer.sources, answer.attribution?.canonicalUrl);
```

### Options

```js
const client = new ValueThen({
  apiKey: process.env.VALUETHEN_API_KEY, // only for higher rate limits
  timeout: 10_000,                       // ms before giving up; default 30000, 0 to disable
  retries: 2,                            // retry 429/502/503/504 and network failures; default 0
  baseUrl: 'https://api.valuethen.com',  // default
  fetch: customFetch,                    // default: the global fetch
});
```

Retries wait for the API's `Retry-After` (up to 60 seconds), or back off from half a second. A GET is always safe to retry; a POST is retried only when you pass an `idempotencyKey`.

### Methods

| Method | Endpoint | Returns |
| --- | --- | --- |
| `convert({ amount, from, fromYear, to?, toYear?, fromMonth?, toMonth?, method? })` | `GET /v1/convert` | The converted amount with `inputs`, `inflation`, `fx`, `sources` and `attribution`. `method` is `cpi-then-fx` (default), `fx-then-cpi` or `cpi`. `XAU` and `XAG` work as currencies |
| `inflate({ amount, currency, fromYear, toYear?, fromMonth?, toMonth? })` | `GET /v1/inflate` | A same-currency adjustment |
| `series(currency, { freq? })` | `GET /v1/series/:currency` | The full price index: `years` and `values`, or `periods` and `values` with `freq: 'monthly'` |
| `metals(metal, { year? })` | `GET /v1/metals/:metal` | Observed gold (`XAU`) or silver (`XAG`) prices per troy ounce: every `record`, or the `quote` for `year` |
| `coverage()` | `GET /v1/coverage` | Every currency with its first and last year, and month where it has monthly data |
| `currencies({ limit?, cursor? })` | `GET /v1/currencies` | One page; pass `pagination.nextCursor` as `cursor` for the next |
| `convertBatch(requests, { idempotencyKey? })` | `POST /v1/convert/batch` | Up to 100 conversions in one call; each succeeds or fails on its own |
| `sandboxConvert({ amount?, from?, to?, fromYear?, toYear? })` | `GET /v1/sandbox/convert` | Fixed sample data in production shapes. Unmetered: use it while building and in tests |

`createSeriesExport()` and `job()` are deprecated: the API no longer has those routes. Call `series()` for each currency instead. Both will be removed in 2.0.

```js
// Up to 100 conversions in one call; the key makes a retry safe.
const batch = await client.convertBatch(
  [
    { id: 'rent', amount: 450, from: 'GBP', fromYear: 1995 },
    { id: 'salary', amount: 24000, from: 'USD', fromYear: 1980 },
  ],
  { idempotencyKey: crypto.randomUUID() },
);
```

### Errors

Every API error is a `ValueThenError` with:

| Field | |
| --- | --- |
| `code` | Machine-readable reason, such as `out_of_coverage`, `rate_limited` or `timeout` |
| `status` | HTTP status, or `0` when no response arrived |
| `message` | A readable explanation |
| `coverage` | On `out_of_coverage`, the valid range: pick a year inside it |
| `retryAfter` | Seconds the API asked you to wait, when it said |
| `problem` | The full RFC 9457 problem details |

```js
try {
  await client.convert({ amount: 1, from: 'EUR', fromYear: 1970 });
} catch (error) {
  if (error instanceof ValueThenError && error.code === 'out_of_coverage') {
    console.log('Valid range:', error.coverage);
  }
}
```

Network failures (no connection at all) are passed through as the runtime's own error.

### TypeScript

Types ship with the package: options, every method, the response fields the SDK relies on, and `ValueThenError`.

```ts
import { ValueThen, type ConversionResult } from 'valuethen';
const result: ConversionResult = await new ValueThen().convert({ from: 'USD', fromYear: 1970 });
```

## Data and limits

Consumer price indices from the World Bank (`FP.CPI.TOTL`), the European Central Bank HICP for the euro area, FRED CPI-U for recent United States years, and OECD monthly indices. Exchange rates are ECB reference rates from 1999, extended earlier by a commercial provider. Gold and silver prices are dated observations (MeasuringWorth, World Bank, Yahoo Finance via freegoldapi.com), not a live spot feed. Coverage differs per currency; `coverage()` reports each currency's range.

Results are estimates of purchasing power from annual (or, where asked and available, monthly) averages, not official conversions. Anonymous callers are rate limited per address; every response carries IETF `RateLimit` headers with the current limit, and a 429 carries `Retry-After`.

When you show a figure to a person, quote its `sources` and link `attribution.canonicalUrl`, so they can open the same calculation and change the years.

## For agents

See [AGENTS.md](./AGENTS.md) for when to use this, how to report results, and the MCP endpoints.

This repository is also an [Agent Plugin](https://agent-plugins.org/specification): [plugin.json](./plugin.json) is the manifest, [mcp.json](./mcp.json) declares both MCP servers, and [skills/valuethen/SKILL.md](./skills/valuethen/SKILL.md) is the skill. Install it into a compatible agent by pointing at this repository.

## Links

- [Developer portal](https://valuethen.com/developers/)
- [OpenAPI 3.1 description](https://api.valuethen.com/openapi.json)
- [MCP server](https://api.valuethen.com/mcp)
- [Versioning and deprecation policy](https://api.valuethen.com/versioning)
- [Changelog](CHANGELOG.md)

## Development

```bash
npm test               # offline tests; no dependencies to install
npm run test:contract  # checks the SDK against the live OpenAPI description (needs network)
```

Releases: bump the version in `package.json`, `plugin.json` and `src/index.js`, add a `CHANGELOG.md` entry (`npm test` checks all four agree), merge, then push a `vX.Y.Z` tag. The release workflow publishes to npm with provenance.

Security issues: please email contact@therisingthrone.com rather than opening an issue (see [SECURITY.md](SECURITY.md)).

## Licence

[MIT](LICENSE) © Rising Throne
