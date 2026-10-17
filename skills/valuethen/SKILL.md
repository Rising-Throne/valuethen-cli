---
name: valuethen
description: Convert money across years and currencies using official inflation data. Use when a task compares amounts of money from different years, adjusts a historical price or salary for inflation, or converts an old amount into another currency at today's value.
license: MIT
---

# ValueThen purchasing-power conversion

## When to use this skill

Use it whenever a question compares money across time: "what is X from year Y worth today", adjusting a historical salary, price, budget or contract value, checking an inflation claim, or converting an old amount in one currency into today's value of another.

Do not use it for live exchange rates, forecasts, investment returns, or figures that must be exact for legal or accounting purposes. Results are annual averages and are estimates of purchasing power.

## How to call it

No key, no sign-up. One request answers most questions:

```bash
curl "https://api.valuethen.com/v1/convert?amount=100&from=USD&to=EUR&fromYear=1970&toYear=2026"
```

- `to` defaults to `from`, which gives a pure inflation adjustment.
- `toYear` defaults to the latest year both currencies cover.
- Add `fromMonth` and `toMonth` (1–12, both or neither) for month-to-month figures where monthly indices exist; otherwise the reply falls back to annual averages and says so in `note`.
- `method` is `cpi-then-fx` (default), `fx-then-cpi` or `cpi` (compares the price change in each currency without exchanging money).
- Gold (`XAU`, from 1258) and silver (`XAG`, from 1688) work as currencies. `https://api.valuethen.com/v1/metals/XAU?year=1900` returns the observed price per troy ounce.
- `https://api.valuethen.com/v1/sandbox/convert` answers from fixed sample data, unmetered, for testing an integration. Never quote its figures.

## Reading the reply

`result` is the answer. `frequency` says whether monthly or annual indices were used. `methods` carries every method that could be computed. `fx` names the exchange rate used, `coverage` the data range of each currency, `units` any redenomination factor, and `sources` the exact series behind the number. Quote `sources` when presenting the figure.

## Handling errors

Errors are RFC 9457 problem details with a `code`. On `out_of_coverage` the body repeats the valid range, so pick a year inside it and retry once. On `rate_limited` wait for `Retry-After` seconds. Call `https://api.valuethen.com/v1/coverage` to learn every currency's range up front.

## Other surfaces

- MCP (Streamable HTTP): `https://api.valuethen.com/mcp` — same operations as tools
- OpenAPI 3.1: `https://api.valuethen.com/openapi.json`
- Agent guide: `https://valuethen.com/llms.txt`
