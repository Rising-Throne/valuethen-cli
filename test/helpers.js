/** Test helpers: a scripted fetch and an in-memory terminal. Not a test file itself. */

export function json(body, { status = 200, headers = {} } = {}) {
  return new Response(body === undefined ? '' : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** A fetch that answers from a list of responders, one per call, and records every call. */
export function scriptedFetch(...responders) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: new URL(String(url)), init });
    const next = responders[Math.min(calls.length - 1, responders.length - 1)];
    return typeof next === 'function' ? next(new URL(String(url)), init) : next;
  };
  return { fetch, calls };
}

export function terminal() {
  let out = '';
  let err = '';
  return {
    stdout: { write: (s) => (out += s) },
    stderr: { write: (s) => (err += s) },
    get out() {
      return out;
    },
    get err() {
      return err;
    },
  };
}

export const CONVERSION = {
  inputs: { amount: 100, from: 'USD', to: 'USD', fromYear: 1970, toYear: 2026 },
  result: 853.01,
  inflation: { cumulative: 7.5301 },
  sources: ['World Bank FP.CPI.TOTL, 2010=100', 'recent years chained from CPI-U (FRED CPIAUCNS)'],
  attribution: { canonicalUrl: 'https://valuethen.com/c/example' },
};
