/**
 * ValueThen SDK — a thin client for the free purchasing-power API.
 * No key, no dependencies. Every method returns the parsed JSON body.
 *
 * Results carry an `attribution` object with a credit line and a `canonicalUrl` for the same
 * calculation on the web. Show them when you present a figure to a person.
 */

export const DEFAULT_BASE_URL = 'https://api.valuethen.com';

export class ValueThenError extends Error {
  constructor(problem, status) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}`);
    this.name = 'ValueThenError';
    this.status = status;
    this.code = problem?.code ?? 'unknown';
    this.problem = problem;
    this.coverage = problem?.coverage;
  }
}

export class ValueThen {
  /** @param {{baseUrl?: string, apiKey?: string, fetch?: typeof globalThis.fetch}} [options] */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.apiKey = options.apiKey;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async #get(path, params = {}) {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    const res = await this.fetch(url, { headers: { accept: 'application/json', ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}) } });
    const body = await res.json().catch(() => null);
    if (!res.ok) throw new ValueThenError(body, res.status);
    return body;
  }

  async #post(path, body, { idempotencyKey } = {}) {
    const res = await this.fetch(this.baseUrl + path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}),
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) throw new ValueThenError(json, res.status);
    return json;
  }

  /** What `amount` of `from` in `fromYear` is worth in `toYear`, optionally in another currency. */
  convert({ amount = 1, from, to, fromYear, toYear, method } = {}) {
    return this.#get('/v1/convert', { amount, from, to, fromYear, toYear, method });
  }

  /** Same-currency inflation adjustment. */
  inflate({ amount = 1, currency, fromYear, toYear } = {}) {
    return this.#get('/v1/inflate', { amount, currency, fromYear, toYear });
  }

  /** The full annual consumer price index series for one currency. */
  series(currency) {
    return this.#get(`/v1/series/${encodeURIComponent(String(currency).toUpperCase())}`);
  }

  /** Every supported currency with its first and last year of data. */
  coverage() {
    return this.#get('/v1/coverage');
  }

  /** One page of currencies. Pass `pagination.nextCursor` as `cursor` for the next page. */
  currencies({ limit = 20, cursor } = {}) {
    return this.#get('/v1/currencies', { limit, cursor });
  }

  /** Up to 100 conversions in one request. Pass `idempotencyKey` to make retries safe. */
  convertBatch(requests, { idempotencyKey } = {}) {
    return this.#post('/v1/convert/batch', { requests }, { idempotencyKey });
  }

  /** Start an async export of full series for up to 40 currencies. */
  createSeriesExport(currencies, { idempotencyKey } = {}) {
    return this.#post('/v1/jobs/series-export', { currencies }, { idempotencyKey });
  }

  /** Poll a job created by an async endpoint. */
  job(id) {
    return this.#get(`/v1/jobs/${encodeURIComponent(id)}`);
  }
}

export default ValueThen;
