import { describe, expect, it } from "vitest";
import { buildMessageHistory, summarizeToolResult } from "../agent";
import type { ChatMessage } from "@state/aiStore";

// ---------------------------------------------------------------------------
// Helper to build a minimal ChatMessage
// ---------------------------------------------------------------------------
function msg(
  overrides: Partial<ChatMessage> & { role: ChatMessage["role"]; content: string },
): ChatMessage {
  return {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// summarizeToolResult
// ---------------------------------------------------------------------------

describe("summarizeToolResult", () => {
  it("should return '(no result)' for null/undefined", () => {
    expect(summarizeToolResult("any", null)).toBe("(no result)");
    expect(summarizeToolResult("any", undefined)).toBe("(no result)");
  });

  it("should extract error messages", () => {
    const result = { error: "Something went wrong" };
    expect(summarizeToolResult("any", result)).toBe("error: Something went wrong");
  });

  it("should truncate long error messages", () => {
    const result = { error: "x".repeat(200) };
    const summary = summarizeToolResult("any", result);
    expect(summary.length).toBeLessThanOrEqual(160); // "error: " + 150 + "…"
    expect(summary).toContain("…");
  });

  it("should extract first line from compact text data", () => {
    const result = { data: "Built workflow: 5 tools\nID map:\n  a → b" };
    expect(summarizeToolResult("build_workflow", result)).toBe("Built workflow: 5 tools");
  });

  it("should truncate long compact text data", () => {
    const result = { data: "x".repeat(300) };
    const summary = summarizeToolResult("any", result);
    expect(summary.length).toBeLessThanOrEqual(201); // 200 + "…"
  });

  // Legacy format tests
  it("should summarize legacy build_workflow result", () => {
    const result = { toolCount: 3, wireCount: 2 };
    expect(summarizeToolResult("build_workflow", result)).toBe("3 tools, 2 wires");
  });

  it("should summarize legacy build_workflow with columns", () => {
    const result = {
      toolCount: 2,
      wireCount: 1,
      inputColumns: [{ name: "id" }, { name: "name" }],
    };
    expect(summarizeToolResult("build_workflow", result)).toBe("2 tools, 1 wires, columns: id, name");
  });

  it("should summarize preview_tool_output", () => {
    const result = {
      rowCount: 100,
      schema: [{ name: "a" }, { name: "b" }],
    };
    expect(summarizeToolResult("preview_tool_output", result)).toBe("100 rows, schema: a, b");
  });

  it("should summarize get_column_metadata", () => {
    const result = {
      columns: [
        { name: "age", dtype: "Int64" },
        { name: "name", dtype: "Utf8" },
      ],
    };
    expect(summarizeToolResult("get_column_metadata", result)).toBe("cols: age(Int64), name(Utf8)");
  });

  it("should summarize search_files", () => {
    const result = {
      results: [{ path: "/data/a.csv" }, { path: "/data/b.csv" }],
    };
    expect(summarizeToolResult("search_files", result)).toBe("2 results /data/a.csv, /data/b.csv");
  });

  it("should summarize add_tool", () => {
    const result = { type: "Filter", toolId: "abc-123", connected: true };
    expect(summarizeToolResult("add_tool", result)).toBe("Filter [abc-123] connected");
  });

  it("should summarize add_tool without connection", () => {
    const result = { type: "Input", toolId: "xyz-456", connected: false };
    expect(summarizeToolResult("add_tool", result)).toBe("Input [xyz-456]");
  });

  it("should summarize update_tool", () => {
    const result = { updatedFields: ["expression", "mode"] };
    expect(summarizeToolResult("update_tool", result)).toBe("updated expression, mode");
  });

  it("should summarize update_tools with summary", () => {
    const result = { summary: "Updated 3/3 tools" };
    expect(summarizeToolResult("update_tools", result)).toBe("Updated 3/3 tools");
  });

  it("should summarize remove_tool", () => {
    const result = { removedType: "Filter" };
    expect(summarizeToolResult("remove_tool", result)).toBe("removed Filter");
  });

  it("should summarize connect_tools success", () => {
    expect(summarizeToolResult("connect_tools", { success: true })).toBe("ok");
  });

  it("should summarize disconnect_tools failure", () => {
    expect(summarizeToolResult("disconnect_tools", { success: false })).toBe("failed");
  });

  it("should summarize profile_tool_data", () => {
    const result = { rowCount: 1000, columnCount: 12 };
    expect(summarizeToolResult("profile_tool_data", result)).toBe("1000 rows, 12 cols profiled");
  });

  it("should summarize ask_user with string answer", () => {
    const result = { answer: "yes" };
    expect(summarizeToolResult("ask_user", result)).toBe("user answered: yes");
  });

  it("should summarize ask_user with array answer", () => {
    const result = { answer: ["option1", "option2"] };
    expect(summarizeToolResult("ask_user", result)).toBe("user answered: option1, option2");
  });

  it("should summarize list_available_files with roots", () => {
    const result = { roots: ["/data", "/uploads"], count: 2 };
    expect(summarizeToolResult("list_available_files", result)).toBe("2 roots: /data, /uploads");
  });

  it("should summarize list_available_files with files", () => {
    const result = { directory: "/data", files: ["a.csv", "b.csv", "c.csv"], count: 3 };
    expect(summarizeToolResult("list_available_files", result)).toBe("3 files in /data");
  });

  it("should fall back to JSON for unknown tool names", () => {
    const result = { custom: "data" };
    expect(summarizeToolResult("unknown_tool", result)).toBe('{"custom":"data"}');
  });
});

// ---------------------------------------------------------------------------
// buildMessageHistory
// ---------------------------------------------------------------------------

describe("buildMessageHistory", () => {
  it("should filter out non-user/assistant messages", () => {
    const messages: ChatMessage[] = [
      msg({ role: "user", content: "hello" }),
      msg({ role: "tool" as ChatMessage["role"], content: "tool output" }),
      msg({ role: "assistant", content: "hi" }),
    ];

    const result = buildMessageHistory(messages);
    expect(result).toHaveLength(2);
    expect(result[0]!.role).toBe("user");
    expect(result[1]!.role).toBe("assistant");
  });

  it("should preserve user messages as-is", () => {
    const messages: ChatMessage[] = [
      msg({ role: "user", content: "Build a filter workflow" }),
    ];

    const result = buildMessageHistory(messages);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ role: "user", content: "Build a filter workflow" });
  });

  it("should append tool call summaries to assistant messages", () => {
    const messages: ChatMessage[] = [
      msg({
        role: "assistant",
        content: "I'll add a filter tool.",
        toolCalls: [
          { toolName: "add_tool", args: {}, result: { type: "Filter", toolId: "abc", connected: true } },
        ],
      }),
    ];

    const result = buildMessageHistory(messages);
    expect(result).toHaveLength(1);
    expect(result[0]!.content).toContain("I'll add a filter tool.");
    expect(result[0]!.content).toContain("[add_tool → Filter [abc] connected]");
  });

  it("should use only tool summaries when content is '(No response)'", () => {
    const messages: ChatMessage[] = [
      msg({
        role: "assistant",
        content: "(No response)",
        toolCalls: [
          { toolName: "remove_tool", args: {}, result: { removedType: "Sort" } },
        ],
      }),
    ];

    const result = buildMessageHistory(messages);
    expect(result[0]!.content).toBe("[remove_tool → removed Sort]");
    expect(result[0]!.content).not.toContain("(No response)");
  });

  it("should use only tool summaries when content is empty", () => {
    const messages: ChatMessage[] = [
      msg({
        role: "assistant",
        content: "",
        toolCalls: [
          { toolName: "connect_tools", args: {}, result: { success: true } },
        ],
      }),
    ];

    const result = buildMessageHistory(messages);
    expect(result[0]!.content).toBe("[connect_tools → ok]");
  });

  it("should handle multiple tool calls in one message", () => {
    const messages: ChatMessage[] = [
      msg({
        role: "assistant",
        content: "Setting up the pipeline.",
        toolCalls: [
          { toolName: "add_tool", args: {}, result: { type: "Input", toolId: "1", connected: false } },
          { toolName: "add_tool", args: {}, result: { type: "Filter", toolId: "2", connected: true } },
        ],
      }),
    ];

    const result = buildMessageHistory(messages);
    expect(result[0]!.content).toContain("[add_tool → Input [1]]");
    expect(result[0]!.content).toContain("[add_tool → Filter [2] connected]");
  });

  it("should limit history by token budget, not fixed count", () => {
    const messages: ChatMessage[] = [];
    // Create messages with ~1000 chars each (~250 tokens)
    // With a 60k token budget (~240k chars), about 240 messages should fit
    for (let i = 0; i < 300; i++) {
      messages.push(msg({
        role: i % 2 === 0 ? "user" : "assistant",
        content: "x".repeat(1000) + ` Message ${i}`,
      }));
    }

    const result = buildMessageHistory(messages);
    // Should include many messages but not all 300
    expect(result.length).toBeGreaterThan(40); // More than old fixed limit
    expect(result.length).toBeLessThan(300);
    // Should keep the most recent messages
    expect(result[result.length - 1]!.content).toContain("Message 299");
  });

  it("should handle assistant messages without tool calls", () => {
    const messages: ChatMessage[] = [
      msg({ role: "assistant", content: "Here's the result." }),
    ];

    const result = buildMessageHistory(messages);
    expect(result[0]).toEqual({ role: "assistant", content: "Here's the result." });
  });

  it("should handle empty message list", () => {
    expect(buildMessageHistory([])).toEqual([]);
  });
});
