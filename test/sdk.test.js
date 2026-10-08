import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_TIMEOUT_MS, parseRetryAfter, ValueThen, ValueThenError } from '../src/index.js';
import { json, scriptedFetch } from './helpers.js';

test('GET requests carry the query and no body', async () => {
  const { fetch, calls } = scriptedFetch(json({ result: 1 }));
  await new ValueThen({ fetch }).convert({ amount: 100, from: 'USD', fromYear: 1970, to: undefined });
  const [{ url, init }] = calls;
  assert.equal(url.href, 'https://api.valuethen.com/v1/convert?amount=100&from=USD&fromYear=1970');
  assert.equal(init.method, 'GET');
  assert.equal(init.body, undefined);
  assert.equal(init.headers.accept, 'application/json');
  assert.equal(init.headers['content-type'], undefined);
});

test('base URL, API key and path encoding', async () => {
  const { fetch, calls } = scriptedFetch(json({}));
  await new ValueThen({ fetch, baseUrl: 'https://example.test/', apiKey: 'k1' }).series('gbp');
  assert.equal(calls[0].url.href, 'https://example.test/v1/series/GBP');
  assert.equal(calls[0].init.headers['X-Api-Key'], 'k1');
});

test('every method calls its endpoint', async () => {
  const { fetch, calls } = scriptedFetch(json({}));
  const c = new ValueThen({ fetch });
  await c.inflate({ amount: 5, currency: 'TRY', fromYear: 1990 });
  await c.coverage();
  await c.currencies({ cursor: 'abc' });
  await c.job('job/1');
  assert.deepEqual(
    calls.map((x) => x.url.pathname + x.url.search),
    ['/v1/inflate?amount=5&currency=TRY&fromYear=1990', '/v1/coverage', '/v1/currencies?limit=20&cursor=abc', '/v1/jobs/job%2F1'],
  );
});

test('POSTs send JSON and the idempotency key', async () => {
  const { fetch, calls } = scriptedFetch(json({ ok: true }));
  const c = new ValueThen({ fetch });
  await c.convertBatch([{ id: 'a', amount: 1, from: 'USD', fromYear: 1970 }], { idempotencyKey: 'key-1' });
  await c.createSeriesExport(['USD', 'EUR']);
  assert.equal(calls[0].url.pathname, '/v1/convert/batch');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), { requests: [{ id: 'a', amount: 1, from: 'USD', fromYear: 1970 }] });
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.equal(calls[0].init.headers['Idempotency-Key'], 'key-1');
  assert.equal(calls[1].url.pathname, '/v1/jobs/series-export');
  assert.equal(calls[1].init.headers['Idempotency-Key'], undefined);
});

test('API errors become ValueThenError with the problem details', async () => {
  const problem = { code: 'out_of_coverage', detail: 'EUR starts in 1999', coverage: { cpiFrom: 1999, cpiTo: 2026 } };
  const { fetch } = scriptedFetch(json(problem, { status: 422 }));
  const error = await new ValueThen({ fetch }).convert({ from: 'EUR', fromYear: 1970 }).catch((e) => e);
  assert.ok(error instanceof ValueThenError);
  assert.equal(error.status, 422);
  assert.equal(error.code, 'out_of_coverage');
  assert.equal(error.message, 'EUR starts in 1999');
  assert.deepEqual(error.coverage, { cpiFrom: 1999, cpiTo: 2026 });
  assert.equal(error.retryAfter, undefined);
});

test('a 429 reports rate_limited and how long to wait', async () => {
  const { fetch } = scriptedFetch(json(undefined, { status: 429, headers: { 'retry-after': '12' } }));
  const error = await new ValueThen({ fetch }).coverage().catch((e) => e);
  assert.equal(error.code, 'rate_limited');
  assert.equal(error.retryAfter, 12);
  assert.equal(error.problem, null);
});

test('parseRetryAfter reads seconds and HTTP dates', () => {
  const now = Date.parse('2026-09-02T12:00:00Z');
  assert.equal(parseRetryAfter('7', now), 7);
  assert.equal(parseRetryAfter('Wed, 02 Sep 2026 12:00:30 GMT', now), 30);
  assert.equal(parseRetryAfter('Wed, 02 Sep 2026 11:00:00 GMT', now), 0);
  assert.equal(parseRetryAfter('soon', now), undefined);
  assert.equal(parseRetryAfter(null, now), undefined);
});

test('requests time out with code timeout', async () => {
  const hang = (_, init) =>
    new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))));
  const error = await new ValueThen({ fetch: hang, timeout: 20 }).coverage().catch((e) => e);
  assert.ok(error instanceof ValueThenError);
  assert.equal(error.code, 'timeout');
  assert.equal(error.status, 0);
  assert.equal(DEFAULT_TIMEOUT_MS, 30_000);
});

test('timeout 0 waits as long as it takes', async () => {
  const slow = () => new Promise((resolve) => setTimeout(() => resolve(json({ done: true })), 30));
  assert.deepEqual(await new ValueThen({ fetch: slow, timeout: 0 }).coverage(), { done: true });
});

test('GETs retry 503 and 429, honouring Retry-After', async () => {
  const { fetch, calls } = scriptedFetch(
    json({}, { status: 503, headers: { 'retry-after': '0' } }),
    json({}, { status: 429, headers: { 'retry-after': '0' } }),
    json({ result: 2 }),
  );
  assert.deepEqual(await new ValueThen({ fetch, retries: 2 }).coverage(), { result: 2 });
  assert.equal(calls.length, 3);
});

test('no retries by default', async () => {
  const { fetch, calls } = scriptedFetch(json({}, { status: 503, headers: { 'retry-after': '0' } }), json({}));
  await assert.rejects(new ValueThen({ fetch }).coverage(), ValueThenError);
  assert.equal(calls.length, 1);
});

test('POSTs retry only with an idempotency key', async () => {
  const failing = () => json({}, { status: 503, headers: { 'retry-after': '0' } });
  const without = scriptedFetch(failing, json({}));
  await assert.rejects(new ValueThen({ fetch: without.fetch, retries: 3 }).convertBatch([]));
  assert.equal(without.calls.length, 1);

  const withKey = scriptedFetch(failing, json({ ok: true }));
  assert.deepEqual(await new ValueThen({ fetch: withKey.fetch, retries: 3 }).convertBatch([], { idempotencyKey: 'k' }), { ok: true });
  assert.equal(withKey.calls.length, 2);
});

test('a Retry-After longer than 60 s is not waited for', async () => {
  const { fetch, calls } = scriptedFetch(json({}, { status: 429, headers: { 'retry-after': '120' } }), json({}));
  const error = await new ValueThen({ fetch, retries: 3 }).coverage().catch((e) => e);
  assert.equal(error.retryAfter, 120);
  assert.equal(calls.length, 1);
});

test('network failures are retried, then rethrown as they were', async () => {
  let n = 0;
  const flaky = async () => {
    n += 1;
    if (n === 1) throw new TypeError('fetch failed');
    return json({ ok: true });
  };
  assert.deepEqual(await new ValueThen({ fetch: flaky, retries: 1 }).coverage(), { ok: true });

  const down = async () => {
    throw new TypeError('fetch failed');
  };
  await assert.rejects(new ValueThen({ fetch: down }).coverage(), { name: 'TypeError', message: 'fetch failed' });
});

test('the global fetch is never called as a method of the client', async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let receiver;
  globalThis.fetch = async function (...args) {
    receiver = this;
    return json({ ok: true });
  };
  const client = new ValueThen();
  await client.coverage();
  assert.notEqual(receiver, client);
});
