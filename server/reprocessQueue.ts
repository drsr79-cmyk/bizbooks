export const DEFAULT_REPROCESS_CONCURRENCY = 3;
export const MAX_REPROCESS_CONCURRENCY = 10;

export function getReprocessConcurrency(
  configuredValue = process.env.DOCUMENT_REPROCESS_CONCURRENCY
): number {
  if (!configuredValue) return DEFAULT_REPROCESS_CONCURRENCY;

  const parsed = Number.parseInt(configuredValue, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_REPROCESS_CONCURRENCY;
  }

  return Math.min(parsed, MAX_REPROCESS_CONCURRENCY);
}

export async function runWithConcurrencyLimit<T>(
  items: readonly T[],
  concurrency: number,
  processItem: (item: T, index: number) => Promise<void>
): Promise<void> {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new RangeError("Concurrency must be a positive integer");
  }

  let nextIndex = 0;
  const workerCount = Math.min(concurrency, items.length);

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await processItem(items[index]!, index);
    }
  };

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
}
