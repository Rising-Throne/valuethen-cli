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
  /** First and last year with a price index; null for currencies that only have exchange rates. */
  cpiFrom?: number | null;
  cpiTo?: number | null;
  /** First year with exchange rates. */
  fxFrom?: number | null;
  /** First and last month (`YYYY-MM`) with a monthly price index, or null when there is none. */
  monthlyFrom?: string | null;
  monthlyTo?: string | null;
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

/**
 * `cpi` across currencies compares the price change in each without exchanging money.
 * `ppp` is kept for compatibility; the API currently answers it with `method_unavailable`.
 */
export type ConversionMethod = 'cpi-then-fx' | 'fx-then-cpi' | 'cpi' | 'ppp';

export interface ConvertParams {
  /** Default 1. */
  amount?: number;
  from: string;
  /** Defaults to `from`, which gives a pure inflation adjustment. */
  to?: string;
  fromYear: number;
  /** Defaults to the latest year both currencies cover. */
  toYear?: number;
  /** Month (1–12) of `fromYear`. Send with `toMonth` to use monthly price indices where they exist. */
  fromMonth?: number;
  /** Month (1–12) of `toYear`; pairs with `fromMonth`. */
  toMonth?: number;
  /** Default `cpi-then-fx`. */
  method?: ConversionMethod;
}

export interface InflateParams {
  amount?: number;
  currency: string;
  fromYear: number;
  toYear?: number;
  fromMonth?: number;
  toMonth?: number;
}

export interface SandboxConvertParams {
  amount?: number;
  from?: string;
  to?: string;
  fromYear?: number;
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
  inputs: {
    amount: number;
    from: string;
    to: string;
    fromYear: number;
    toYear: number;
    /** The months used, or null when the calculation used annual averages. */
    fromMonth?: number | null;
    toMonth?: number | null;
    [key: string]: unknown;
  };
  /** The method behind `result`. */
  method?: ConversionMethod;
  /** `monthly` when monthly price indices were used, otherwise `annual`. */
  frequency?: 'annual' | 'monthly';
  /** Every method's figure, or null where it could not be computed. */
  methods?: Partial<Record<ConversionMethod, number | null>>;
  /** Cumulative and annualised change, overall or per currency. */
  inflation?: Record<string, unknown>;
  /** The exchange rate used, in cross-currency conversions. */
  fx?: { atToYear?: { rate: number; actualDate: string; [key: string]: unknown }; [key: string]: unknown } | null;
  /** Redenomination factors per currency, when old units were converted to current ones. */
  units?: Record<string, { atFromYear?: number; atToYear?: number; [key: string]: unknown }>;
  /** The data range of each currency involved. */
  coverage?: Record<string, Coverage>;
  /** The exact series behind the number. Quote them. */
  sources: string[];
  note?: string;
  attribution?: Attribution;
  computedAt?: string;
  [key: string]: unknown;
}

export interface Series {
  currency: string;
  source: string;
  frequency?: 'annual' | 'monthly';
  /** Annual series: one year per value. */
  years: number[];
  /** Monthly series: one `YYYY-MM` label per value. Empty when the currency has no monthly index. */
  periods?: string[];
  values: number[];
  baseYear?: number | null;
  coverage?: Coverage;
  /** Currency reforms: amounts before `year` are in old units. */
  redenominations?: Array<{ year: number; factor: number }>;
  [key: string]: unknown;
}

export interface CoverageResult {
  currencies: Array<Coverage & { currency: string; name: string; country?: string; kind?: 'fiat' | 'metal' }>;
  updatedAt?: string;
  [key: string]: unknown;
}

export type Metal = 'XAU' | 'XAG';

export interface MetalQuote {
  date: string;
  price: number;
  /** GBP before 1792, USD after. */
  currency: string;
  source?: string;
  [key: string]: unknown;
}

export interface MetalResult {
  metal: string;
  unit: 'troy ounce';
  source: string;
  coverage: { from?: string; to?: string };
  note?: string;
  /** Every observation, when no year was asked for. */
  records?: MetalQuote[];
  /** With a year: the last observation on or before its end. */
  quote?: MetalQuote;
  requestedDate?: string;
  [key: string]: unknown;
}

export interface CurrencyPage {
  pagination?: { nextCursor?: string | null; [key: string]: unknown };
  [key: string]: unknown;
}

export interface BatchRequest extends Omit<ConvertParams, 'fromMonth' | 'toMonth'> {
  /** Your id for matching results to requests. */
  id: string;
}

export interface BatchResult {
  /** One entry per request, in the order sent. Each succeeds or fails on its own. */
  results: Array<{
    id?: string;
    status: 'ok' | 'error';
    data?: ConversionResult;
    error?: { code: string; message: string };
  }>;
  summary: { total: number; ok: number; failed: number };
  computedAt?: string;
  [key: string]: unknown;
}

export declare class ValueThen {
  constructor(options?: ValueThenOptions);
  baseUrl: string;
  apiKey?: string;
  timeout: number;
  retries: number;
  convert(params: ConvertParams): Promise<ConversionResult>;
  inflate(params: InflateParams): Promise<ConversionResult>;
  series(currency: string, params?: { freq?: 'annual' | 'monthly' }): Promise<Series>;
  /** Observed gold or silver prices per troy ounce: every record, or the one for `year`. Not a live spot price. */
  metals(metal: Metal | Lowercase<Metal>, params?: { year?: number }): Promise<MetalResult>;
  /** Fixed sample data in production shapes: unmetered, for building and testing. Not real figures. */
  sandboxConvert(params?: SandboxConvertParams): Promise<ConversionResult>;
  coverage(): Promise<CoverageResult>;
  currencies(params?: { limit?: number; cursor?: string }): Promise<CurrencyPage>;
  /** Up to 100 conversions. Pass `idempotencyKey` to make retries safe. */
  convertBatch(requests: BatchRequest[], options?: { idempotencyKey?: string }): Promise<BatchResult>;
  /** @deprecated The API no longer offers series exports and answers 404. Call `series()` per currency. Removed in 2.0. */
  createSeriesExport(currencies: string[], options?: { idempotencyKey?: string }): Promise<Record<string, unknown>>;
  /** @deprecated The API no longer offers jobs and answers 404. Removed in 2.0. */
  job(id: string): Promise<Record<string, unknown>>;
}

export default ValueThen;
