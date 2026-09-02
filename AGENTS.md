# Agent instructions — ValueThen

## What this is

`valuethen` is the official CLI and SDK for the ValueThen purchasing-power API. It converts an amount of money from one year into the equivalent purchasing power in another year, optionally in another currency, using official consumer price indices and central-bank exchange rates.

## When to use it

Reach for it whenever a task compares money across time: adjusting a historical salary, price, budget, prize or contract value for inflation; checking a claim like "X in 1970 is Y today"; or converting an old amount in one currency into today's value of another. Use the CLI for one-off answers in a shell, and the SDK when the result feeds other code.

Do not use it for live or intraday exchange rates, forecasts of future inflation, investment returns, or figures that must be exact for legal, tax or accounting purposes. Results are annual averages and are estimates of purchasing power.

## How to call it

```bash
npx valuethen convert 100 USD 1970          # same currency, latest year
npx valuethen convert 100 USD 1970 EUR 2024 # cross-currency
npx valuethen inflate 1000 TRY 1990 --json  # raw API response
npx valuethen coverage                      # every currency and its data range
```

```js
import { ValueThen } from 'valuethen';
const client = new ValueThen();
const { result, sources } = await client.convert({ amount: 100, from: 'USD', fromYear: 1970 });
```

No API key is needed. Pass `--api-key` or `new ValueThen({ apiKey })` only if one was issued for higher rate limits.

## Rules when reporting a result

- Quote the `sources` field. Every figure traces to a named official series.
- Say the figure is an estimate of purchasing power based on annual averages, not an official conversion.
- Coverage differs per currency. On an `out_of_coverage` error the response carries the valid range; pick a year inside it and retry once rather than guessing.
- The current year is a year-to-date average and moves as new monthly data is published.

## Error handling

Errors are RFC 9457 problem details. `ValueThenError` exposes `code`, `status`, `problem` and `coverage`. Handle `out_of_coverage` by retrying inside the returned range, and `rate_limited` by waiting for the `Retry-After` seconds.

## Other surfaces

- REST + OpenAPI 3.1: https://api.valuethen.com/openapi.json
- MCP (Streamable HTTP): https://api.valuethen.com/mcp
- Documentation MCP: https://valuethen.com/mcp
- Agent guide: https://valuethen.com/llms.txt
- Skill: https://valuethen.com/.well-known/agent-skills/valuethen/SKILL.md
