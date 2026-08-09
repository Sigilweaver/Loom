import { describe, expect, it } from "vitest";

import { DATA_SOURCES } from "../DataSourceSelector";
import {
  createSourceConfiguration,
  getConfiguredSourceIds,
} from "../SourceConfigurationPanel";

describe("source configuration registry", () => {
  it("creates canonical input defaults", () => {
    expect(createSourceConfiguration("input", "csv", {}, "read")).toEqual({
      category: "file",
      type: "csv",
      csvMode: "read",
    });
    expect(createSourceConfiguration("input", "ods")).toMatchObject({
      category: "file",
      type: "ods",
      sheet_id: 1,
      has_header: true,
    });
  });

  it("preserves relevant values when changing source configuration", () => {
    expect(
      createSourceConfiguration("input", "postgresql", {
        connectionId: "connection-1",
        filePath: "/old/file.csv",
      }),
    ).toEqual({
      category: "database",
      type: "postgresql",
      query: "",
      connectionId: "connection-1",
    });
  });

  it("creates canonical output defaults", () => {
    expect(createSourceConfiguration("output", "excel")).toMatchObject({
      category: "file",
      type: "excel",
      include_header: true,
      autofilter: true,
    });
  });

  it("returns undefined for unsupported operation and source pairs", () => {
    expect(createSourceConfiguration("output", "postgresql")).toBeUndefined();
  });

  it.each(["input", "output"] as const)(
    "has configuration for every enabled %s selector entry",
    (operation) => {
      const selectable = DATA_SOURCES.filter((source) => {
        const operations = source.supportedOperations || ["input", "output"];
        return source.enabled && operations.includes(operation);
      })
        .map((source) => source.id)
        .sort();

      expect(getConfiguredSourceIds(operation)).toEqual(selectable);
    },
  );
});
