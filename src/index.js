/**
 * ValueThen SDK — a thin client for the free purchasing-power API.
 * No key, no dependencies. Every method returns the parsed JSON body.
 *
 * Results carry an `attribution` object with a credit line and a `canonicalUrl` for the same
 * calculation on the web. Show them when you present a figure to a person.
 */

export const VERSION = '1.2.0';
export const DEFAULT_BASE_URL = 'https://api.valuethen.com';
/** Requests that get no response within this many milliseconds fail with code `timeout`. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Statuses worth retrying: rate limited, or the server briefly unavailable. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);
/** Never wait longer than this for a retry, whatever the server asks. */
const MAX_RETRY_WAIT_S = 60;

export class ValueThenError extends Error {
  /**
   * @param {object | null} problem RFC 9457 problem details from the API, if any
   * @param {number} status HTTP status, or 0 when no response arrived
   * @param {{ retryAfter?: number }} [extra]
   */
  constructor(problem, status, { retryAfter } = {}) {
    super(problem?.detail ?? problem?.title ?? `Request failed with status ${status}`);
    this.name = 'ValueThenError';
    this.status = status;
    this.code = problem?.code ?? (status === 429 ? 'rate_limited' : 'unknown');
    this.problem = problem;
    this.coverage = problem?.coverage;
    /** Seconds the API asked you to wait before trying again, when it said. */
    this.retryAfter = retryAfter;
  }
}

/**
 * Seconds to wait from a `Retry-After` header, which is either a number of seconds or an
 * HTTP date. Returns `undefined` when the header is missing or unreadable.
 */
export function parseRetryAfter(value, now = Date.now()) {
  if (value === null || value === undefined || String(value).trim() === '') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const at = Date.parse(String(value));
  return Number.isNaN(at) ? undefined : Math.max(0, Math.ceil((at - now) / 1000));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** 0.5 s, 1 s, 2 s … capped at 8 s. */
const backoffSeconds = (attempt) => Math.min(0.5 * 2 ** attempt, 8);

export class ValueThen {
  /**
   * @param {{
   *   baseUrl?: string,
   *   apiKey?: string,
   *   fetch?: typeof globalThis.fetch,
   *   timeout?: number,
   *   retries?: number,
   * }} [options]
   */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.apiKey = options.apiKey;
    // Keep a plain function: browsers throw "Illegal invocation" when the global fetch is
    // called as a method of another object, which `this.fetch(...)` would do.
    const supplied = options.fetch;
    this.fetch = supplied ?? ((...args) => globalThis.fetch(...args));
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.retries = Math.max(0, Math.floor(options.retries ?? 0));
  }

  async #request(method, path, { query, body, idempotencyKey } = {}) {
    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
    const headers = {
      accept: 'application/json',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(this.apiKey ? { 'X-Api-Key': this.apiKey } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    };
    // A GET can always be repeated; a POST only when an idempotency key makes it safe.
    const canRetry = method === 'GET' || Boolean(idempotencyKey);

    for (let attempt = 0; ; attempt += 1) {
      const controller = new AbortController();
      let timedOut = false;
      const timer =
        this.timeout > 0
          ? setTimeout(() => {
              timedOut = true;
              controller.abort();
            }, this.timeout)
          : undefined;

      let res;
      try {
        res = await this.fetch(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (error) {
        if (timedOut) {
          throw new ValueThenError(
            { code: 'timeout', detail: `No response from ${this.baseUrl} within ${this.timeout / 1000} s` },
            0,
          );
        }
        if (canRetry && attempt < this.retries) {
          await sleep(backoffSeconds(attempt) * 1000);
          continue;
        }
        throw error;
      } finally {
        clearTimeout(timer);
      }

      const json = await res.json().catch(() => null);
      if (res.ok) return json;

      const retryAfter = parseRetryAfter(res.headers?.get?.('retry-after'));
      const wait = retryAfter ?? backoffSeconds(attempt);
      if (canRetry && attempt < this.retries && RETRYABLE_STATUS.has(res.status) && wait <= MAX_RETRY_WAIT_S) {
        await sleep(wait * 1000);
        continue;
      }
      throw new ValueThenError(json, res.status, { retryAfter });
    }
  }

  /** What `amount` of `from` in `fromYear` is worth in `toYear`, optionally in another currency. */
  convert({ amount = 1, from, to, fromYear, toYear, method } = {}) {
    return this.#request('GET', '/v1/convert', { query: { amount, from, to, fromYear, toYear, method } });
  }

  /** Same-currency inflation adjustment. */
  inflate({ amount = 1, currency, fromYear, toYear } = {}) {
    return this.#request('GET', '/v1/inflate', { query: { amount, currency, fromYear, toYear } });
  }

  /** The full annual consumer price index series for one currency. */
  series(currency) {
    return this.#request('GET', `/v1/series/${encodeURIComponent(String(currency).toUpperCase())}`);
  }

  /** Every supported currency with its first and last year of data. */
  coverage() {
    return this.#request('GET', '/v1/coverage');
  }

  /** One page of currencies. Pass `pagination.nextCursor` as `cursor` for the next page. */
  currencies({ limit = 20, cursor } = {}) {
    return this.#request('GET', '/v1/currencies', { query: { limit, cursor } });
  }

  /** Up to 100 conversions in one request. Pass `idempotencyKey` to make retries safe. */
  convertBatch(requests, { idempotencyKey } = {}) {
    return this.#request('POST', '/v1/convert/batch', { body: { requests }, idempotencyKey });
  }

  /** Start an async export of full series for up to 40 currencies. */
  createSeriesExport(currencies, { idempotencyKey } = {}) {
    return this.#request('POST', '/v1/jobs/series-export', { body: { currencies }, idempotencyKey });
  }

  /** Poll a job created by an async endpoint. */
  job(id) {
    return this.#request('GET', `/v1/jobs/${encodeURIComponent(id)}`);
  }
}

export default ValueThen;
