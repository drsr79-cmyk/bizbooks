import { describe, expect, it, vi } from "vitest";
import {
  BoundedTaskQueue,
  DEFAULT_REPROCESS_CONCURRENCY,
  getReprocessConcurrency,
  MAX_REPROCESS_CONCURRENCY,
} from "./reprocessQueue";

describe("BoundedTaskQueue", () => {
  it("shares one concurrency bound across overlapping batches", async () => {
    const queue = new BoundedTaskQueue(3);
    let active = 0;
    let maxActive = 0;

    const processDocument = vi.fn(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
    });

    const enqueueBatch = () =>
      Promise.all(
        Array.from({ length: 15 }, () => queue.enqueue(processDocument))
      );

    await Promise.all([enqueueBatch(), enqueueBatch()]);

    expect(processDocument).toHaveBeenCalledTimes(30);
    expect(maxActive).toBe(3);
  });

  it("uses fewer workers when the backlog is smaller than the limit", async () => {
    const queue = new BoundedTaskQueue(5);
    let active = 0;
    let maxActive = 0;

    await Promise.all(
      [1, 2].map(() =>
        queue.enqueue(async () => {
          active++;
          maxActive = Math.max(maxActive, active);
          await new Promise(resolve => setTimeout(resolve, 2));
          active--;
        })
      )
    );

    expect(maxActive).toBe(2);
  });

  it("rejects an invalid concurrency instead of running unbounded", () => {
    expect(() => new BoundedTaskQueue(0)).toThrow("positive integer");
  });
});

describe("getReprocessConcurrency", () => {
  it("uses the default when configuration is absent or invalid", () => {
    expect(getReprocessConcurrency(undefined)).toBe(
      DEFAULT_REPROCESS_CONCURRENCY
    );
    expect(getReprocessConcurrency("invalid")).toBe(
      DEFAULT_REPROCESS_CONCURRENCY
    );
    expect(getReprocessConcurrency("0")).toBe(DEFAULT_REPROCESS_CONCURRENCY);
  });

  it("accepts a positive configured limit and caps extreme values", () => {
    expect(getReprocessConcurrency("5")).toBe(5);
    expect(getReprocessConcurrency("999")).toBe(MAX_REPROCESS_CONCURRENCY);
  });
});
