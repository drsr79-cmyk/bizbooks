import { describe, expect, it } from "vitest";
import { normalizeKey, sanitizeFileName } from "./storage";

describe("storage key normalization", () => {
  it.each([
    ["/docs/7/file.pdf", "docs/7/file.pdf"],
    [String.raw`docs\7\file.pdf`, "docs/7/file.pdf"],
    ["docs/7/../../evil.txt", "docs/7/evil.txt"],
    ["/../docs/./7/file..pdf", "docs/7/file_pdf"],
  ])("normalizes %s without traversal segments", (input, expected) => {
    expect(normalizeKey(input)).toBe(expected);
  });
});

describe("storage filename sanitization", () => {
  it.each([
    ["../../evil.txt", "____evil.txt"],
    ["/etc/cron.d/evil", "_etc_cron.d_evil"],
    [String.raw`..\..\evil.txt`, "____evil.txt"],
    ["invoice-August 2026.pdf", "invoice-August 2026.pdf"],
  ])("sanitizes %s to a single safe segment", (input, expected) => {
    const sanitized = sanitizeFileName(input);
    expect(sanitized).toBe(expected);
    expect(sanitized).not.toMatch(/[\\/]/);
    expect(sanitized).not.toContain("..");
  });
});
