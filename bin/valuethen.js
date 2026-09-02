#!/usr/bin/env node
/** ValueThen CLI — convert money across years from the command line. */
import { ValueThen, ValueThenError } from '../src/index.js';

const HELP = `valuethen — what money from an earlier year is worth today

Usage
  valuethen convert <amount> <from> <fromYear> [to] [toYear]   Convert across years and currencies
  valuethen inflate <amount> <currency> <fromYear> [toYear]    Same-currency inflation adjustment
  valuethen series <currency>                                  Full annual price index series
  valuethen coverage                                           Every currency and its data range

Options
  --json        Print the raw API response
  --api-key K   Send an API key for higher rate limits
  --base URL    Point at another API base (default https://api.valuethen.com)
  --help        Show this help

Examples
  valuethen convert 100 USD 1970
  valuethen convert 100 USD 1970 EUR 2026
  valuethen inflate 1000 TRY 1990 --json
  valuethen coverage | head

Data: World Bank, ECB and FRED. Results are annual averages and are estimates of
purchasing power, not official conversions. Docs: https://valuethen.com/developers/
`;

const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const value = argv[i + 1];
  argv.splice(i, value && !value.startsWith('--') ? 2 : 1);
  return value ?? true;
};

const asJson = Boolean(flag('json'));
const apiKey = flag('api-key');
const baseUrl = flag('base');
if (flag('help') || flag('h') || argv.length === 0) {
  process.stdout.write(HELP);
  process.exit(0);
}

const client = new ValueThen({ apiKey: typeof apiKey === 'string' ? apiKey : undefined, baseUrl: typeof baseUrl === 'string' ? baseUrl : undefined });
const [command, ...args] = argv;
const money = (n, currency) => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
const pct = (n) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;

try {
  if (command === 'convert' || command === 'inflate') {
    const [amount, currency, fromYear, third, fourth] = args;
    if (!amount || !currency || !fromYear) throw new Error(`Usage: valuethen ${command} <amount> <currency> <fromYear> [...]`);
    const query = command === 'convert'
      ? { amount: Number(amount), from: currency.toUpperCase(), fromYear: Number(fromYear), to: third ? third.toUpperCase() : undefined, toYear: fourth ? Number(fourth) : undefined }
      : { amount: Number(amount), currency: currency.toUpperCase(), fromYear: Number(fromYear), toYear: third ? Number(third) : undefined };
    const data = command === 'convert' ? await client.convert(query) : await client.inflate(query);
    if (asJson) { console.log(JSON.stringify(data, null, 2)); process.exit(0); }
    const i = data.inputs;
    const change = data.inflation?.[i.from]?.cumulative ?? data.inflation?.cumulative;
    console.log(`${money(i.amount, i.from)} in ${i.fromYear}  =  ${money(data.result, i.to)} in ${i.toYear}`);
    if (typeof change === 'number') console.log(`Price change: ${pct(change)}`);
    if (data.fx?.atToYear) console.log(`Rate used: 1 ${i.from} = ${data.fx.atToYear.rate} ${i.to} (${data.fx.atToYear.actualDate})`);
    if (data.note) console.log(`Note: ${data.note}`);
    console.log(`Sources: ${(data.sources ?? []).join('; ')}`);
  } else if (command === 'series') {
    const data = await client.series(args[0] ?? 'USD');
    if (asJson) { console.log(JSON.stringify(data, null, 2)); process.exit(0); }
    console.log(`${data.currency} — ${data.source}`);
    for (let i = 0; i < data.years.length; i++) console.log(`${data.years[i]}\t${data.values[i]}`);
  } else if (command === 'coverage') {
    const data = await client.coverage();
    if (asJson) { console.log(JSON.stringify(data, null, 2)); process.exit(0); }
    for (const c of data.currencies) console.log(`${c.currency}\t${c.cpiFrom ?? '?'}–${c.cpiTo ?? '?'}\t${c.name}`);
  } else {
    throw new Error(`Unknown command: ${command}. Run valuethen --help.`);
  }
} catch (error) {
  if (error instanceof ValueThenError) {
    console.error(`${error.code}: ${error.message}`);
    if (error.coverage) console.error(`Valid range: ${error.coverage.cpiFrom}–${error.coverage.cpiTo}`);
  } else {
    console.error(error.message);
  }
  process.exit(1);
}
