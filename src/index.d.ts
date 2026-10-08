/** Types for the ValueThen SDK. Response types list the fields the SDK and CLI rely on; the API may return more. */

export declare const VERSION: string;
export declare const DEFAULT_BASE_URL: string;
export declare const DEFAULT_TIMEOUT_MS: number;

export interface ValueThenOptions {
  /** API base URL. Default `https://api.valuethen.com`. */
  baseUrl?: string;
  /** Only needed for higher rate limits. */
  apiKey?: string;
  /** A fetch implementation, for tests or older runtimes. */
  fetch?: typeof globalThis.fetch;
  /** Milliseconds before a request fails with code `timeout`. Default 30000; 0 disables. */
  timeout?: number;
  /**
   * Times to retry 429, 502, 503 and 504 responses and network failures. Default 0.
   * GETs are always retried; POSTs only when an idempotency key is supplied.
   */
  retries?: number;
}

/** RFC 9457 problem details, as returned by the API on errors. */
export interface Problem {
  type?: string;
  title?: string;
  detail?: string;
  status?: number;
  code?: string;
  coverage?: Coverage;
  [key: string]: unknown;
}

export interface Coverage {
  cpiFrom?: number;
  cpiTo?: number;
  [key: string]: unknown;
}

export declare class ValueThenError extends Error {
  constructor(problem: Problem | null, status: number, extra?: { retryAfter?: number });
  readonly name: 'ValueThenError';
  /** HTTP status, or 0 when no response arrived (for example on `timeout`). */
  status: number;
  /** Machine-readable code, e.g. `out_of_coverage`, `rate_limited`, `timeout`. */
  code: string;
  problem: Problem | null;
  /** The valid range, on `out_of_coverage`. */
  coverage?: Coverage;
  /** Seconds the API asked you to wait, when it sent Retry-After. */
  retryAfter?: number;
}

/** Seconds from a Retry-After header value (seconds or HTTP date). */
export declare function parseRetryAfter(value: string | null | undefined, now?: number): number | undefined;

export type ConversionMethod = 'cpi-then-fx' | 'fx-then-cpi' | 'ppp';

export interface ConvertParams {
  /** Default 1. */
  amount?: number;
  from: string;
  /** Defaults to `from`, which gives a pure inflation adjustment. */
  to?: string;
  fromYear: number;
  /** Defaults to the latest year both currencies cover. */
  toYear?: number;
  /** Default `cpi-then-fx`. */
  method?: ConversionMethod;
}

export interface InflateParams {
  amount?: number;
  currency: string;
  fromYear: number;
  toYear?: number;
}

export interface Attribution {
  /** The same calculation on valuethen.com. Link it when you present the figure. */
  canonicalUrl?: string;
  [key: string]: unknown;
}

export interface ConversionResult {
  /** The answer. */
  result: number;
  inputs: { amount: number; from: string; to: string; fromYear: number; toYear: number; [key: string]: unknown };
  /** Cumulative and annualised change, overall or per currency. */
  inflation?: Record<string, unknown>;
  /** The exchange rate used, in cross-currency conversions. */
  fx?: { atToYear?: { rate: number; actualDate: string; [key: string]: unknown }; [key: string]: unknown };
  /** The exact series behind the number. Quote them. */
  sources: string[];
  note?: string;
  attribution?: Attribution;
  [key: string]: unknown;
}

export interface Series {
  currency: string;
  source: string;
  years: number[];
  values: number[];
  [key: string]: unknown;
}

export interface CoverageResult {
  currencies: Array<{ currency: string; name: string; cpiFrom?: number; cpiTo?: number; [key: string]: unknown }>;
  [key: string]: unknown;
}

export interface CurrencyPage {
  pagination?: { nextCursor?: string | null; [key: string]: unknown };
  [key: string]: unknown;
}

export interface BatchRequest extends ConvertParams {
  /** Your id for matching results to requests. */
  id: string;
}

export declare class ValueThen {
  constructor(options?: ValueThenOptions);
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retries: number;
  convert(params: ConvertParams): Promise<ConversionResult>;
  inflate(params: InflateParams): Promise<ConversionResult>;
  series(currency: string): Promise<Series>;
  coverage(): Promise<CoverageResult>;
  currencies(params?: { limit?: number; cursor?: string }): Promise<CurrencyPage>;
  /** Up to 100 conversions. Pass `idempotencyKey` to make retries safe. */
  convertBatch(requests: BatchRequest[], options?: { idempotencyKey?: string }): Promise<Record<string, unknown>>;
  /** Start an async export of full series for up to 40 currencies. */
  createSeriesExport(currencies: string[], options?: { idempotencyKey?: string }): Promise<Record<string, unknown>>;
  /** Poll a job created by an async endpoint. */
  job(id: string): Promise<Record<string, unknown>>;
}

export default ValueThen;
