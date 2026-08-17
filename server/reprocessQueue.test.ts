import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_REPROCESS_CONCURRENCY,
  getReprocessConcurrency,
  MAX_REPROCESS_CONCURRENCY,
  runWithConcurrencyLimit,
} from "./reprocessQueue";

describe("runWithConcurrencyLimit", () => {
  it("never exceeds the configured concurrency for a large backlog", async () => {
    const documents = Array.from({ length: 15 }, (_, id) => ({ id }));
    let active = 0;
    let maxActive = 0;
    const processed: number[] = [];

    const processDocument = vi.fn(async (document: { id: number }) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      processed.push(document.id);
      active--;
    });

    await runWithConcurrencyLimit(documents, 3, processDocument);

    expect(processDocument).toHaveBeenCalledTimes(15);
    expect(processed).toHaveLength(15);
    expect(maxActive).toBe(3);
  });

  it("uses fewer workers when the backlog is smaller than the limit", async () => {
    let active = 0;
    let maxActive = 0;

    await runWithConcurrencyLimit([1, 2], 5, async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 2));
      active--;
    });

    expect(maxActive).toBe(2);
  });

  it("rejects an invalid concurrency instead of running unbounded", async () => {
    await expect(
      runWithConcurrencyLimit([1], 0, async () => {})
    ).rejects.toThrow("positive integer");
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
