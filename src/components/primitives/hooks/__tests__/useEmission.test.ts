import { describe, expect, test } from "vitest";
import {
  buildEmitPatch,
  calculateShouldEmit,
  mergeEmitPatch,
} from "../useEmission";

describe("useEmission helpers", () => {
  test("calculateShouldEmit handles primitive comparisons", () => {
    expect(calculateShouldEmit(undefined, false)).toBe(false);
    expect(calculateShouldEmit(true, false)).toBe(true);
    expect(calculateShouldEmit("value", "value")).toBe(false);
    expect(calculateShouldEmit("value", "default")).toBe(true);
    expect(calculateShouldEmit([1, 2], [1, 2])).toBe(false);
    expect(calculateShouldEmit([1, 2, 3], [1, 2])).toBe(true);
    expect(calculateShouldEmit({ key: "a" }, { key: "a" })).toBe(false);
    expect(calculateShouldEmit({ key: "b" }, { key: "a" })).toBe(true);
  });

  test("buildEmitPatch creates nested emission maps", () => {
    expect(buildEmitPatch("filePath", true)).toEqual({ filePath: true });
    // False values should result in empty object (not emitted)
    expect(buildEmitPatch("options.sep", false)).toEqual({});
    expect(buildEmitPatch("csv.delimiter", true)).toEqual({
      csv: { delimiter: true },
    });
  });

  test("mergeEmitPatch deeply merges emission metadata", () => {
    const base = { options: { header: false } };
    const patch = { options: { sep: true } };
    expect(mergeEmitPatch(base, patch)).toEqual({
      options: { header: false, sep: true },
    });

    const override = { options: { header: true } };
    expect(mergeEmitPatch(base, override)).toEqual({
      options: { header: true },
    });

    const topLevel = { filePath: false };
    expect(mergeEmitPatch(undefined, topLevel)).toEqual({ filePath: false });
  });
});
