# valuethen

CLI and SDK for the free [ValueThen](https://valuethen.com) purchasing-power API. Convert an amount of money from one year into what it is worth in another, in the same currency or a different one, using official consumer price indices and central-bank exchange rates.

No API key. No sign-up. No dependencies.

```bash
npx valuethen convert 100 USD 1970
# $100.00 in 1970  =  $853.01 in 2026
# Price change: +753.0%
# Sources: World Bank FP.CPI.TOTL, 2010=100; recent years chained from CPI-U (FRED CPIAUCNS)
```

## Install

```bash
npm install valuethen        # SDK
npm install -g valuethen     # CLI on your PATH
```

## CLI

```bash
valuethen convert <amount> <from> <fromYear> [to] [toYear]
valuethen inflate <amount> <currency> <fromYear> [toYear]
valuethen series <currency>
valuethen coverage
```

Flags: `--json` for the raw response, `--api-key` for a higher rate limit, `--base` to point at another deployment.

## SDK

```js
import { ValueThen, ValueThenError } from 'valuethen';

const client = new ValueThen();

const answer = await client.convert({ amount: 100, from: 'USD', to: 'EUR', fromYear: 1970, toYear: 2024 });
console.log(answer.result, answer.sources);

const { years, values } = await client.series('GBP');
const { currencies } = await client.coverage();

// Up to 100 conversions in one call; the key makes a retry safe.
const batch = await client.convertBatch(
  [{ id: 'a', amount: 100, from: 'USD', fromYear: 1970 }],
  { idempotencyKey: crypto.randomUUID() },
);

try {
  await client.convert({ amount: 1, from: 'EUR', fromYear: 1970 });
} catch (error) {
  if (error instanceof ValueThenError && error.code === 'out_of_coverage') {
    console.log('Valid range:', error.coverage);
  }
}
```

## Data and limits

Consumer price indices from the World Bank (`FP.CPI.TOTL`), the European Central Bank HICP for the euro area, and FRED CPI-U for recent United States years. Exchange rates are ECB reference rates from 1999, extended earlier by a commercial provider. Coverage differs per currency; `coverage()` reports each currency's range.

Results are annual averages and are estimates of purchasing power, not official conversions. Anonymous callers get 15 requests per 10 seconds; every response carries IETF `RateLimit` headers and a 429 carries `Retry-After`.

## For agents

See [AGENTS.md](./AGENTS.md) for when to use this, how to report results, and the MCP endpoints.

This repository is also an [Agent Plugin](https://agent-plugins.org/specification): [plugin.json](./plugin.json) is the manifest, [mcp.json](./mcp.json) declares both MCP servers, and [skills/valuethen/SKILL.md](./skills/valuethen/SKILL.md) is the skill. Install it into a compatible agent by pointing at this repository.

## Links

- [Developer portal](https://valuethen.com/developers/)
- [OpenAPI 3.1 description](https://api.valuethen.com/openapi.json)
- [MCP server](https://api.valuethen.com/mcp)
- [Versioning and deprecation policy](https://api.valuethen.com/versioning)

MIT © Rising Throne
