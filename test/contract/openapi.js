/**
 * Checks the SDK against the live API: every route it calls and every query parameter it sends
 * must be in the OpenAPI description, and every `--method` the CLI accepts must be one the API
 * offers. Needs the network, so it runs on a schedule in CI rather than in `npm test`.
 *
 *   node test/contract/openapi.js [baseUrl]
 */

import { METHODS } from '../../src/cli.js';
import { DEFAULT_BASE_URL, ValueThen } from '../../src/index.js';

const base = (process.argv[2] ?? DEFAULT_BASE_URL).replace(/\/$/, '');
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

const spec = await (await fetch(`${base}/openapi.json`)).json();

/** Drive every SDK method with every option set, recording the requests instead of sending them. */
const calls = [];
const recorder = new ValueThen({
  baseUrl: base,
  fetch: async (url, init) => {
    calls.push({ method: init.method, url: new URL(String(url)) });
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  },
});
await recorder.convert({ amount: 1, from: 'USD', to: 'EUR', fromYear: 2000, toYear: 2020, fromMonth: 1, toMonth: 1, method: 'cpi' });
await recorder.inflate({ amount: 1, currency: 'USD', fromYear: 2000, toYear: 2020, fromMonth: 1, toMonth: 1 });
await recorder.series('USD', { freq: 'monthly' });
await recorder.metals('XAU', { year: 1900 });
await recorder.sandboxConvert({ amount: 1, from: 'USD', to: 'EUR', fromYear: 2000, toYear: 2020 });
await recorder.coverage();
await recorder.currencies({ limit: 1, cursor: 'x' });
await recorder.convertBatch([{ id: 'a', from: 'USD', fromYear: 2000 }]);
// createSeriesExport() and job() are deprecated because the API removed their routes.

const templates = Object.entries(spec.paths).map(([path, operations]) => ({
  path,
  operations,
  pattern: new RegExp(`^${path.replace(/\{[^}]+\}/g, '[^/]+')}$`),
}));

for (const { method, url } of calls) {
  const label = `${method} ${url.pathname}`;
  const template = templates.find((t) => t.pattern.test(url.pathname));
  const operation = template?.operations[method.toLowerCase()];
  check(operation, `${label}: not in the OpenAPI description`);
  if (!operation) continue;
  check(!operation.deprecated, `${label}: deprecated by the API`);
  const declared = new Set(
    [...(template.operations.parameters ?? []), ...(operation.parameters ?? [])]
      .filter((p) => p.in === 'query')
      .map((p) => p.name),
  );
  for (const name of url.searchParams.keys()) check(declared.has(name), `${label}: query parameter "${name}" not declared`);
}

const offered = spec.paths['/v1/convert']?.get?.parameters?.find((p) => p.name === 'method')?.schema?.enum ?? [];
for (const method of METHODS) check(offered.includes(method), `--method ${method}: not offered by the API (${offered.join(', ')})`);

// The sandbox answers in production shapes, so it shows whether the fields the CLI prints still exist.
const sample = await new ValueThen({ baseUrl: base }).sandboxConvert();
check(typeof sample?.result === 'number', 'sandbox convert: no numeric result');
check(sample?.inputs && typeof sample.inputs.fromYear === 'number', 'sandbox convert: no inputs');
check(Array.isArray(sample?.sources), 'sandbox convert: no sources');

if (failures.length > 0) {
  console.error(`The SDK has drifted from ${base}:\n${failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log(`${calls.length} SDK requests and ${METHODS.length} methods match ${base}/openapi.json (API ${spec.info?.version}).`);
