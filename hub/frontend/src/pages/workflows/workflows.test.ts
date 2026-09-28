import { describe, it, expect } from "vitest";
import type { WorkflowMetadata } from "@api";
import { buildFolderTree, flattenFolders, isInFolder } from "./folders";
import { fuzzyMatch, searchWorkflows } from "./search";

function workflow(overrides: Partial<WorkflowMetadata>): WorkflowMetadata {
  return {
    id: overrides.name ?? "id",
    name: "Workflow",
    description: "",
    author: "",
    workflow_id: "wf",
    folder_path: "/",
    tags: [],
    checksum: "abc",
    uploaded_by: "user",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("fuzzyMatch", () => {
  it("ranks exact, prefix, substring and subsequence matches in that order", () => {
    const exact = fuzzyMatch("sales", "sales");
    const prefix = fuzzyMatch("sal", "sales report");
    const substring = fuzzyMatch("report", "daily sales report");
    const loose = fuzzyMatch("dsr", "daily sales report");

    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(loose);
    expect(loose).toBeGreaterThan(0);
  });

  it("matches letters in order and rejects missing letters", () => {
    expect(fuzzyMatch("fltr", "filter")).toBeGreaterThan(0);
    expect(fuzzyMatch("xyz", "filter")).toBe(0);
    expect(fuzzyMatch("retlif", "filter")).toBe(0);
  });

  it("treats regex characters in the query literally", () => {
    expect(fuzzyMatch("a.c", "abc a.c")).toBeGreaterThan(0);
    expect(() => fuzzyMatch("(", "text (with) parens")).not.toThrow();
  });

  it("matches everything for an empty query", () => {
    expect(fuzzyMatch("", "anything")).toBe(1);
  });
});

describe("searchWorkflows", () => {
  const workflows = [
    workflow({ name: "Daily Sales Rollup", tags: ["finance"], folder_path: "/finance" }),
    workflow({ name: "Churn Features", description: "Builds sales features", tags: ["ml"], folder_path: "/ml" }),
    workflow({ name: "Log Cleanup" }),
  ];

  it("returns everything for a blank query, in the original order", () => {
    expect(searchWorkflows(workflows, "  ")).toEqual(workflows);
  });

  it("puts name matches ahead of description matches", () => {
    const names = searchWorkflows(workflows, "sales").map((w) => w.name);
    expect(names).toEqual(["Daily Sales Rollup", "Churn Features"]);
  });

  it("requires every term to match", () => {
    expect(searchWorkflows(workflows, "sales ml").map((w) => w.name)).toEqual(["Churn Features"]);
    expect(searchWorkflows(workflows, "sales nothing")).toEqual([]);
  });

  it("searches tags and folders", () => {
    expect(searchWorkflows(workflows, "finance").map((w) => w.name)).toEqual(["Daily Sales Rollup"]);
  });
});

describe("folders", () => {
  const workflows = [
    workflow({ name: "a", folder_path: "/" }),
    workflow({ name: "b", folder_path: "/finance" }),
    workflow({ name: "c", folder_path: "/finance/reports" }),
    workflow({ name: "d", folder_path: "/finance/reports" }),
    workflow({ name: "e", folder_path: "/ml" }),
  ];

  it("builds a nested tree with per-folder counts", () => {
    const tree = buildFolderTree(workflows);
    expect(tree.count).toBe(5);
    expect(tree.children.map((c) => c.path)).toEqual(["/finance", "/ml"]);

    const finance = tree.children[0]!;
    expect(finance.count).toBe(1);
    expect(finance.children[0]).toMatchObject({ name: "reports", path: "/finance/reports", count: 2 });
  });

  it("flattens the tree for small-screen selects", () => {
    const rows = flattenFolders(buildFolderTree(workflows));
    expect(rows.map((r) => [r.path, r.depth])).toEqual([
      ["", 0],
      ["/finance", 1],
      ["/finance/reports", 2],
      ["/ml", 1],
    ]);
  });

  it("selects a folder and its subfolders but not lookalike siblings", () => {
    expect(isInFolder("/ml", "/ml")).toBe(true);
    expect(isInFolder("/ml/models", "/ml")).toBe(true);
    expect(isInFolder("/ml-ops", "/ml")).toBe(false);
    expect(isInFolder("/anything", "")).toBe(true);
  });
});
