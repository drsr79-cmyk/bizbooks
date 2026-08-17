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

type PendingTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

export class BoundedTaskQueue {
  private activeCount = 0;
  private readonly pending: PendingTask<unknown>[] = [];

  constructor(readonly concurrency: number) {
    if (!Number.isInteger(concurrency) || concurrency < 1) {
      throw new RangeError("Concurrency must be a positive integer");
    }
  }

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        run: task,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.drain();
    });
  }

  private drain() {
    while (this.activeCount < this.concurrency && this.pending.length > 0) {
      const task = this.pending.shift()!;
      this.activeCount++;

      void Promise.resolve()
        .then(task.run)
        .then(task.resolve, task.reject)
        .finally(() => {
          this.activeCount--;
          this.drain();
        });
    }
  }
}

// One scheduler for the entire Node.js process. Every reprocessAll request and
// company shares this budget, so overlapping requests cannot multiply the cap.
export const reprocessQueue = new BoundedTaskQueue(getReprocessConcurrency());
