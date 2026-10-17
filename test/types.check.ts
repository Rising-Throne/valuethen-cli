// Compiled by CI with `tsc --noEmit --strict` to keep src/index.d.ts honest. Never run.
import ValueThen, {
  parseRetryAfter,
  ValueThenError,
  type BatchResult,
  type ConversionResult,
  type MetalResult,
  type Series,
} from '../src/index.js';

const client = new ValueThen({ timeout: 5_000, retries: 2, apiKey: 'k' });

export async function examples(): Promise<number> {
  const r: ConversionResult = await client.convert({ amount: 100, from: 'USD', fromYear: 1970, method: 'ppp' });
  const s: Series = await client.series('GBP');
  const monthly: ConversionResult = await client.convert({ from: 'USD', fromYear: 1990, fromMonth: 3, toYear: 2025, toMonth: 6, method: 'cpi' });
  const frequency: 'annual' | 'monthly' | undefined = monthly.frequency;
  const periods: string[] | undefined = (await client.series('USD', { freq: 'monthly' })).periods;
  const gold: MetalResult = await client.metals('xau', { year: 1900 });
  const price: number | undefined = gold.quote?.price;
  await client.sandboxConvert();
  const batch: BatchResult = await client.convertBatch([{ id: 'a', from: 'USD', fromYear: 1970 }], { idempotencyKey: 'x' });
  const failed: number = batch.summary.failed;
  void [frequency, periods, price, failed];
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
  // @ts-expect-error only gold and silver
  await client.metals('XPT');
  // @ts-expect-error batch items take no months
  await client.convertBatch([{ id: 'b', from: 'USD', fromYear: 1970, fromMonth: 1 }]);
  return r.result + s.values.length;
}
