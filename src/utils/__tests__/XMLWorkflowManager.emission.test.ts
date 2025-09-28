import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Tool, ToolConfig } from "../../domain/workflow/entities/workflow";
import { XMLWorkflowManager } from "../XMLWorkflowManager";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-123"),
}));

vi.mock("../../../package.json", () => ({
  default: { version: "1.0.0" },
}));

describe("XMLWorkflowManager emission controls", () => {
  let manager: XMLWorkflowManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new XMLWorkflowManager();
  });

  test("shouldEmitValue evaluates primitives and collections correctly", () => {
    expect(manager.shouldEmitValue(undefined)).toBe(false);
    expect(manager.shouldEmitValue(null)).toBe(false);
    expect(manager.shouldEmitValue("")).toBe(false);
    expect(manager.shouldEmitValue("   ")).toBe(false);
    expect(manager.shouldEmitValue(" ")).toBe(true);
    expect(manager.shouldEmitValue("\t")).toBe(true);
    expect(manager.shouldEmitValue("value")).toBe(true);
    expect(manager.shouldEmitValue(0)).toBe(true);
    expect(manager.shouldEmitValue(false)).toBe(true);
    expect(manager.shouldEmitValue([])).toBe(false);
    expect(manager.shouldEmitValue(["value"])).toBe(true);
    expect(manager.shouldEmitValue({} as Record<string, unknown>)).toBe(false);
    expect(
      manager.shouldEmitValue({ key: "value" } as Record<string, unknown>)
    ).toBe(true);
  });

  test("respects _emit decisions for top-level fields and persists metadata", () => {
    const tool: Tool = {
      id: "emit-tool",
      type: "Input",
      x: 10,
      y: 20,
      config: {
        category: "file",
        type: "csv",
        filePath: "/tmp/data.csv",
        _emit: {
          filePath: false,
        },
      } as ToolConfig,
      sockets: [],
    };

    manager.addTool(tool);

    const xmlWithoutFilePath = manager.toXMLString();
    expect(xmlWithoutFilePath).not.toContain("<filePath>");
    expect(xmlWithoutFilePath).not.toContain("_emit");

    const storedTool = manager.getTools().find((t) => t.id === "emit-tool");
    expect(storedTool?.config._emit).toEqual({ filePath: false });

    manager.updateToolConfiguration("emit-tool", {
      category: "file",
      type: "csv",
      filePath: "/tmp/data.csv",
      _emit: {
        filePath: true,
      },
    });

    const xmlWithFilePath = manager.toXMLString();
    expect(xmlWithFilePath).toContain("<filePath>/tmp/data.csv</filePath>");

    const rehydratedTool = manager.getTools().find((t) => t.id === "emit-tool");
    expect(rehydratedTool?.config._emit).toEqual({ filePath: true });
  });

  test("applies _emit logic within options block for CSV configs", () => {
    const tool: Tool = {
      id: "options-tool",
      type: "Input",
      x: 0,
      y: 0,
      config: {
        category: "file",
        type: "csv",
        options: {
          header: "infer",
          sep: "|",
        },
        _emit: {
          options: {
            header: true,
            sep: false,
          },
        },
      } as ToolConfig,
      sockets: [],
    };

    manager.addTool(tool);

    const xml = manager.toXMLString();
    expect(xml).toContain("<header>infer</header>");
    expect(xml).not.toContain("<sep>|</sep>");

    const savedTool = manager.getTools().find((t) => t.id === "options-tool");
    expect(savedTool?.config._emit).toEqual({
      options: {
        header: true,
        sep: false,
      },
    });
  });
});
