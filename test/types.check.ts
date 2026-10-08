// Compiled by CI with `tsc --noEmit --strict` to keep src/index.d.ts honest. Never run.
import ValueThen, { parseRetryAfter, ValueThenError, type ConversionResult, type Series } from '../src/index.js';

const client = new ValueThen({ timeout: 5_000, retries: 2, apiKey: 'k' });

export async function examples(): Promise<number> {
  const r: ConversionResult = await client.convert({ amount: 100, from: 'USD', fromYear: 1970, method: 'ppp' });
  const s: Series = await client.series('GBP');
  await client.convertBatch([{ id: 'a', from: 'USD', fromYear: 1970 }], { idempotencyKey: 'x' });
  try {
    await client.coverage();
  } catch (e) {
    if (e instanceof ValueThenError) {
      const wait: number | undefined = e.retryAfter ?? parseRetryAfter('5');
      void wait;
    }
  }
  // @ts-expect-error fromYear is required
  await client.convert({ from: 'USD' });
  // @ts-expect-error not a conversion method
  await client.convert({ from: 'USD', fromYear: 1970, method: 'guess' });
  return r.result + s.values.length;
}
