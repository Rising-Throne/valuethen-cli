/** ValueThen CLI — convert money across years from the command line. */

import { parseArgs } from 'node:util';
import { DEFAULT_BASE_URL, ValueThen, ValueThenError, VERSION } from './index.js';

export const HELP = `valuethen — what money from an earlier year is worth today

Usage
  valuethen convert <amount> <from> <fromYear> [to] [toYear]   Convert across years and currencies
  valuethen inflate <amount> <currency> <fromYear> [toYear]    Same-currency inflation adjustment
  valuethen series <currency>                                  Full annual price index series
  valuethen coverage                                           Every currency and its data range

Options
  --json           Print the raw API response
  --api-key KEY    Send an API key for higher rate limits (or set VALUETHEN_API_KEY)
  --base URL       Point at another API base (default ${DEFAULT_BASE_URL})
  --timeout SECS   Give up after this many seconds (default 30)
  -h, --help       Show this help
  -v, --version    Show the version

Options can go anywhere: before, between or after the arguments.

Examples
  valuethen convert 100 USD 1970
  valuethen convert 100 USD 1970 EUR 2026
  valuethen inflate 1000 TRY 1990 --json
  valuethen coverage | head

Exit codes: 0 success, 1 the request failed, 2 the command was not valid.

Data: World Bank, ECB and FRED. Results are annual averages and are estimates of
purchasing power, not official conversions. Docs: https://valuethen.com/developers/
`;

const USAGE = {
  convert: 'valuethen convert <amount> <from> <fromYear> [to] [toYear]',
  inflate: 'valuethen inflate <amount> <currency> <fromYear> [toYear]',
  series: 'valuethen series <currency>',
  coverage: 'valuethen coverage',
};

/** A mistake in the command itself: reported with usage, exit code 2. */
class UsageError extends Error {}

function amountArg(value) {
  const n = Number(value);
  if (value === undefined || value === '' || !Number.isFinite(n) || n <= 0) {
    throw new UsageError(`Amount must be a positive number; got "${value ?? ''}".`);
  }
  return n;
}

function currencyArg(value, name = 'Currency') {
  if (!/^[A-Za-z]{3}$/.test(value ?? '')) {
    throw new UsageError(`${name} must be a three-letter code such as USD; got "${value ?? ''}".`);
  }
  return value.toUpperCase();
}

function yearArg(value, name = 'Year') {
  const n = Number(value);
  if (!/^\d{1,4}$/.test(value ?? '') || n < 1) {
    throw new UsageError(`${name} must be a year such as 1970; got "${value ?? ''}".`);
  }
  return n;
}

function expectCount(command, args, min, max) {
  if (args.length < min || args.length > max) {
    throw new UsageError(`Usage: ${USAGE[command]}`);
  }
}

const money = (n, currency) =>
  new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
const pct = (n) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;

/**
 * Runs the CLI and resolves to its exit code. Everything it touches is injectable, so it can be
 * tested without a network or a child process.
 *
 * @param {string[]} argv arguments after the program name
 * @param {{ env?: Record<string, string | undefined>, stdout?: { write(s: string): unknown },
 *           stderr?: { write(s: string): unknown }, fetch?: typeof globalThis.fetch }} [io]
 * @returns {Promise<number>}
 */
export async function run(argv, io = {}) {
  const env = io.env ?? process.env;
  const out = (s) => (io.stdout ?? process.stdout).write(`${s}\n`);
  const err = (s) => (io.stderr ?? process.stderr).write(`${s}\n`);

  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
        'api-key': { type: 'string' },
        base: { type: 'string' },
        timeout: { type: 'string' },
      },
    }));
  } catch (error) {
    const option = /'(-[^' ]+)/.exec(error.message)?.[1];
    const message =
      error.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' && option ? `Unknown option: ${option}` : error.message;
    err(`${message}\nRun valuethen --help for usage.`);
    return 2;
  }

  if (values.version) {
    out(`valuethen ${VERSION}`);
    return 0;
  }
  if (values.help || positionals.length === 0) {
    (io.stdout ?? process.stdout).write(HELP);
    return 0;
  }

  const [command, ...args] = positionals;
  const baseUrl = values.base ?? DEFAULT_BASE_URL;

  try {
    let timeout;
    if (values.timeout !== undefined) {
      const seconds = Number(values.timeout);
      if (!Number.isFinite(seconds) || seconds <= 0) {
        throw new UsageError(`--timeout must be a positive number of seconds; got "${values.timeout}".`);
      }
      timeout = seconds * 1000;
    }

    const client = new ValueThen({
      apiKey: values['api-key'] ?? (env.VALUETHEN_API_KEY || undefined),
      baseUrl,
      timeout,
      fetch: io.fetch,
    });
    const print = (data) => out(JSON.stringify(data, null, 2));

    if (command === 'convert' || command === 'inflate') {
      let data;
      if (command === 'convert') {
        expectCount(command, args, 3, 5);
        const [amount, from, fromYear, to, toYear] = args;
        data = await client.convert({
          amount: amountArg(amount),
          from: currencyArg(from),
          fromYear: yearArg(fromYear, 'From year'),
          to: to === undefined ? undefined : currencyArg(to, 'Target currency'),
          toYear: toYear === undefined ? undefined : yearArg(toYear, 'To year'),
        });
      } else {
        expectCount(command, args, 3, 4);
        const [amount, currency, fromYear, toYear] = args;
        data = await client.inflate({
          amount: amountArg(amount),
          currency: currencyArg(currency),
          fromYear: yearArg(fromYear, 'From year'),
          toYear: toYear === undefined ? undefined : yearArg(toYear, 'To year'),
        });
      }
      if (values.json) {
        print(data);
        return 0;
      }
      const i = data.inputs;
      const change = data.inflation?.[i.from]?.cumulative ?? data.inflation?.cumulative;
      out(`${money(i.amount, i.from)} in ${i.fromYear}  =  ${money(data.result, i.to)} in ${i.toYear}`);
      if (typeof change === 'number') out(`Price change: ${pct(change)}`);
      if (data.fx?.atToYear) out(`Rate used: 1 ${i.from} = ${data.fx.atToYear.rate} ${i.to} (${data.fx.atToYear.actualDate})`);
      if (data.note) out(`Note: ${data.note}`);
      out(`Sources: ${(data.sources ?? []).join('; ')}`);
      if (data.attribution?.canonicalUrl) out(`Open this calculation: ${data.attribution.canonicalUrl}`);
      return 0;
    }

    if (command === 'series') {
      expectCount(command, args, 1, 1);
      const data = await client.series(currencyArg(args[0]));
      if (values.json) {
        print(data);
        return 0;
      }
      out(`${data.currency} — ${data.source}`);
      for (let y = 0; y < data.years.length; y += 1) out(`${data.years[y]}\t${data.values[y]}`);
      return 0;
    }

    if (command === 'coverage') {
      expectCount(command, args, 0, 0);
      const data = await client.coverage();
      if (values.json) {
        print(data);
        return 0;
      }
      for (const c of data.currencies) out(`${c.currency}\t${c.cpiFrom ?? '?'}–${c.cpiTo ?? '?'}\t${c.name}`);
      return 0;
    }

    throw new UsageError(`Unknown command: ${command}. Run valuethen --help.`);
  } catch (error) {
    if (error instanceof UsageError) {
      err(error.message);
      return 2;
    }
    if (error instanceof ValueThenError) {
      err(`${error.code}: ${error.message}`);
      if (error.coverage) err(`Valid range: ${error.coverage.cpiFrom}–${error.coverage.cpiTo}`);
      if (error.retryAfter !== undefined) err(`Try again in ${Math.ceil(error.retryAfter)} s.`);
      return 1;
    }
    err(`Could not reach ${baseUrl}: ${error.message}`);
    return 1;
  }
}
