import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HELP, run } from '../src/cli.js';
import { VERSION } from '../src/index.js';
import { CONVERSION, json, scriptedFetch, terminal } from './helpers.js';

async function cli(argv, { fetch = scriptedFetch(json(CONVERSION)).fetch, env = {} } = {}) {
  const term = terminal();
  const code = await run(argv, { fetch, env, stdout: term.stdout, stderr: term.stderr });
  return { code, out: term.out, err: term.err };
}

test('convert prints the answer, change, sources and a link', async () => {
  const { code, out } = await cli(['convert', '100', 'USD', '1970']);
  assert.equal(code, 0);
  assert.equal(
    out,
    [
      '$100.00 in 1970  =  $853.01 in 2026',
      'Price change: +753.0%',
      'Sources: World Bank FP.CPI.TOTL, 2010=100; recent years chained from CPI-U (FRED CPIAUCNS)',
      'Open this calculation: https://valuethen.com/c/example',
      '',
    ].join('\n'),
  );
});

test('cross-currency output names the rate and any note', async () => {
  const data = {
    ...CONVERSION,
    inputs: { ...CONVERSION.inputs, to: 'EUR', toYear: 2024 },
    result: 790.5,
    inflation: { USD: { cumulative: 7.1 } },
    fx: { atToYear: { rate: 0.92, actualDate: '2024-12-31' } },
    note: 'Annual averages.',
  };
  const { out } = await cli(['convert', '100', 'usd', '1970', 'eur', '2024'], { fetch: scriptedFetch(json(data)).fetch });
  assert.match(out, /€790\.50 in 2024/);
  assert.match(out, /Price change: \+710\.0%/);
  assert.match(out, /Rate used: 1 USD = 0\.92 EUR \(2024-12-31\)/);
  assert.match(out, /Note: Annual averages\./);
});

test('options work before, between and after the arguments', async () => {
  for (const argv of [
    ['--json', 'convert', '100', 'USD', '1970'],
    ['convert', '--json', '100', 'USD', '1970'],
    ['convert', '100', 'USD', '--json', '1970'],
    ['convert', '100', 'USD', '1970', '--json'],
  ]) {
    const { fetch, calls } = scriptedFetch(json(CONVERSION));
    const { code, out } = await cli(argv, { fetch });
    assert.equal(code, 0, argv.join(' '));
    assert.deepEqual(JSON.parse(out), CONVERSION);
    assert.equal(calls[0].url.search, '?amount=100&from=USD&fromYear=1970');
  }
});

test('help and version', async () => {
  for (const argv of [[], ['-h'], ['--help'], ['convert', '--help']]) {
    const { code, out } = await cli(argv);
    assert.equal(code, 0);
    assert.equal(out, HELP);
  }
  for (const argv of [['-v'], ['--version']]) {
    assert.equal((await cli(argv)).out, `valuethen ${VERSION}\n`);
  }
});

test('inflate, series and coverage', async () => {
  const inflate = scriptedFetch(json(CONVERSION));
  await cli(['inflate', '1000', 'try', '1990', '2020'], { fetch: inflate.fetch });
  assert.equal(inflate.calls[0].url.pathname + inflate.calls[0].url.search, '/v1/inflate?amount=1000&currency=TRY&fromYear=1990&toYear=2020');

  const series = { currency: 'GBP', source: 'World Bank', years: [2023, 2024], values: [130.1, 133.2] };
  assert.equal((await cli(['series', 'gbp'], { fetch: scriptedFetch(json(series)).fetch })).out, 'GBP — World Bank\n2023\t130.1\n2024\t133.2\n');

  const coverage = { currencies: [{ currency: 'USD', name: 'US dollar', cpiFrom: 1913, cpiTo: 2026 }, { currency: 'XYZ', name: 'Test' }] };
  assert.equal((await cli(['coverage'], { fetch: scriptedFetch(json(coverage)).fetch })).out, 'USD\t1913–2026\tUS dollar\nXYZ\t?–?\tTest\n');
});

test('invalid commands exit 2 without calling the API', async () => {
  const cases = [
    [['convert', 'abc', 'USD', '1970'], /Amount must be a positive number; got "abc"/],
    [['convert', '-5', 'USD', '1970'], /Unknown option: -5/],
    [['convert', '100', 'US', '1970'], /Currency must be a three-letter code/],
    [['convert', '100', 'USD', 'nineteen'], /From year must be a year/],
    [['convert', '100', 'USD', '1970', 'EUR', '2024', 'extra'], /Usage: valuethen convert/],
    [['inflate', '100', 'USD'], /Usage: valuethen inflate/],
    [['series'], /Usage: valuethen series/],
    [['coverage', 'extra'], /Usage: valuethen coverage/],
    [['frobnicate'], /Unknown command: frobnicate/],
    [['coverage', '--nope'], /Unknown option: --nope/],
    [['coverage', '--timeout', '0'], /--timeout must be a positive number/],
  ];
  for (const [argv, message] of cases) {
    const { fetch, calls } = scriptedFetch(json(CONVERSION));
    const { code, err } = await cli(argv, { fetch });
    assert.equal(code, 2, argv.join(' '));
    assert.match(err, message, argv.join(' '));
    assert.equal(calls.length, 0, argv.join(' '));
  }
});

test('API key from --api-key or VALUETHEN_API_KEY', async () => {
  const fromEnv = scriptedFetch(json(CONVERSION));
  await cli(['coverage'], { fetch: fromEnv.fetch, env: { VALUETHEN_API_KEY: 'env-key' } });
  assert.equal(fromEnv.calls[0].init.headers['X-Api-Key'], 'env-key');

  const fromFlag = scriptedFetch(json(CONVERSION));
  await cli(['coverage', '--api-key', 'flag-key'], { fetch: fromFlag.fetch, env: { VALUETHEN_API_KEY: 'env-key' } });
  assert.equal(fromFlag.calls[0].init.headers['X-Api-Key'], 'flag-key');
});

test('API errors exit 1 with the code, the valid range and the wait', async () => {
  const coverage = json(
    { code: 'out_of_coverage', detail: 'EUR starts in 1999', coverage: { cpiFrom: 1999, cpiTo: 2026 } },
    { status: 422 },
  );
  const a = await cli(['convert', '1', 'EUR', '1970'], { fetch: scriptedFetch(coverage).fetch });
  assert.equal(a.code, 1);
  assert.equal(a.err, 'out_of_coverage: EUR starts in 1999\nValid range: 1999–2026\n');

  const limited = json({ code: 'rate_limited', detail: 'Too many requests' }, { status: 429, headers: { 'retry-after': '12' } });
  const b = await cli(['coverage'], { fetch: scriptedFetch(limited).fetch });
  assert.equal(b.code, 1);
  assert.equal(b.err, 'rate_limited: Too many requests\nTry again in 12 s.\n');
});

test('network failures exit 1 and name the API', async () => {
  const down = async () => {
    throw new TypeError('fetch failed');
  };
  const { code, err } = await cli(['coverage', '--base', 'https://example.test'], { fetch: down });
  assert.equal(code, 1);
  assert.equal(err, 'Could not reach https://example.test: fetch failed\n');
});
