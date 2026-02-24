# AI Development Philosophy

This document describes how AI features are designed, validated, and constrained in Sigilweaver. The goal is to make AI genuinely useful for building data workflows while keeping the user firmly in control.

## AI Is Not a Core Feature

Sigilweaver is a visual data pipeline platform. The AI assistant is a convenience layer on top of that platform — it is not the product itself. Every workflow the assistant builds can be built by hand, and the application is fully functional without AI enabled.

This distinction matters for development decisions. AI should be applied where it provides clear, measurable value — eliminating boilerplate that machines handle effortlessly but humans shouldn't waste time on, translating natural language to expressions, explaining unfamiliar workflows. It should **not** be applied to problems that are better solved by good UI design, clear documentation, or deterministic logic. If a feature works reliably without AI, adding AI to it is not an improvement.

## Core Principles

### The user is always in charge

AI is **opt-in and off by default**. No AI features activate until the user explicitly configures a provider and API key. Every action the assistant takes is visible in the chat log, and every change it makes to the canvas can be undone with Ctrl+Z.

### Assist, don't replace

The assistant builds workflows using the same tools, wires, and configurations a user would create by hand. It does not introduce hidden logic, custom code blocks, or opaque transformations. If you can't build it manually in the tool palette, the AI can't build it either.

This also means we do not gate basic functionality behind AI. A user who never enables AI should never feel like they are missing core capabilities.

### Validate at every layer, but know the limits

LLM outputs are inherently probabilistic. Rather than hoping the model gets it right, we validate at every layer. But validation catches _structural_ errors — malformed schemas, missing fields, invalid connections. It does not catch _semantic_ errors like filtering on the wrong column, choosing the wrong join type, or misinterpreting an ambiguous request. No amount of guardrails eliminates the need for the user to review what the assistant produced.

The validation layers:

| Layer | What it catches |
| --- | --- |
| **Zod schemas** | Malformed tool call arguments — wrong types, missing fields, extra properties |
| **Compiler** | Unknown tool types, duplicate IDs, invalid connections between steps |
| **Config enrichment** | Expression format mismatches (e.g., join key arrays, filter operation structures, aggregation shapes) |
| **Column metadata checks** | The system prompt instructs the agent to always query actual column names before writing expressions — never invent them |
| **Iteration cap** | Runaway loops are stopped at a configurable step limit (default: 25) |

### Transparency over magic

Every tool call the assistant executes is rendered inline in the chat. Users see the tool name, arguments (in debug mode), and result summary. There is no hidden state — what you see in the chat is what happened on the canvas.

## Architecture

```
User prompt
    |
    v
System prompt (behavioral rules + tool schemas)
    |
    v
LLM (provider-agnostic via AI SDK)
    |
    v
Tool calls ──> Zod schema validation ──> Tool execution
    |                                         |
    v                                         v
Streaming response                   Canvas state mutations
    |                                    (addTool, addWire,
    v                                     updateTool, etc.)
Chat UI
```

### Provider agnostic

The assistant works with any OpenAI-compatible API. Provider selection, model choice, and API keys are configured by the user. All API traffic routes through a server-side proxy to avoid CORS issues and keep keys out of browser storage.

### Structured tool calling

The assistant communicates with the canvas exclusively through a fixed set of 14 tools:

**Canvas mutation:**
- `add_tool` / `remove_tool` / `update_tool` / `update_tools` — Single or batch tool modifications
- `connect_tools` / `disconnect_tools` — Wire management
- `batch_canvas_ops` — Execute multiple canvas operations (add, connect, update, remove) in one call with cross-references

**Data inspection:**
- `preview_tool_output` / `get_column_metadata` / `profile_tool_data` — Read and profile data from tool outputs

**File discovery:**
- `list_available_files` / `search_files` — Browse and search the data directory

**Workflow building:**
- `build_workflow` — Compile a multi-step workflow description in one shot

**User interaction:**
- `ask_user` — Present clarifying questions with optional predefined choices

Each tool has a Zod schema that validates the LLM's arguments before execution. If validation fails, the error is returned to the model so it can self-correct.

### Config enrichment

LLMs often produce configurations that are _semantically_ correct but _structurally_ different from what the execution engine expects. The enrichment layer normalizes these:

- **Filter** — Wraps raw expressions into the `{ column, operation, value }` structure when needed
- **Join** — Ensures join keys are arrays of `{ left, right }` pairs and drops empty arrays to prevent accidental cross joins
- **Summarize** — Normalizes aggregation definitions to the expected shape

This runs automatically after every `add_tool` or `update_tool` call.

## Behavioral Constraints

The system prompt encodes explicit rules the model must follow:

1. **Always check column metadata** before writing column-dependent expressions. Never invent column names.
2. **Always search for files** before referencing file paths. Never guess paths.
3. **Build reproducible pipelines** — results must be computable from the workflow, not from the model doing mental arithmetic.
4. **Handle errors gracefully** — if a preview fails, read the error, adjust the configuration, and retry.
5. **Remind the user to review** — the model is instructed to note that AI-generated workflows should be reviewed for accuracy.
6. **Ask before assuming** — when the user's request is ambiguous, the model should ask a clarifying question rather than guessing. Getting it wrong and rebuilding wastes more time than a one-question pause.

## Safety Measures

| Measure | Description |
| --- | --- |
| **Disabled by default** | AI features require explicit opt-in |
| **No credential storage in browser** | API keys are sent to the server proxy per-request |
| **Hop-by-hop header stripping** | The proxy strips `origin`, `referer`, `proxy-authorization`, and other sensitive headers before forwarding to the LLM provider |
| **Request timeouts** | 300-second upstream timeout; 15-second timeout for model listing |
| **Abort support** | Users can cancel generation at any time via the stop button |
| **Context window management** | Token-budgeted history packing (~60k tokens) ensures older messages are trimmed before context overflow |
| **Per-tab isolation** | Each tab has its own chat session, run queue, and cancel semantics |
| **Canvas write guard** | Agent tool calls verify tab ownership before mutating the canvas, preventing cross-tab writes |
| **Streaming proxy** | Server proxy preserves SSE streaming end-to-end for progressive token display |
| **Error classification** | Errors are categorized (auth, rate-limit, network, overloaded) with user-friendly messages |
| **Lazy loading** | AI SDK modules are only imported when AI is enabled — non-AI users pay zero bundle cost |

## Testing

AI features are covered by unit tests:

- **Compiler tests** — Valid compilation, unknown tool types, duplicate IDs, invalid connections, UUID generation, socket injection, auto-layout, config merging
- **Prompt construction tests** — System prompt assembly, conditional formula catalog, dynamic context injection
- **Provider tests** — Provider abstraction and model resolution
- **Agent tests** — Message history budgeting, tool result summarization, error classification, re-entrancy guard
- **AI store tests** — Tab session snapshot/restore, multi-agent run queues, concurrency guardrails
- **Enrichment tests** — Filter, formula, and join config normalization
- **Tool-registry parity test** — Validates AGENT_TOOLS keys match TOOL_DESCRIPTIONS keys (prevents UI/runtime drift)

Integration-level testing is done through manual agent sessions with representative workflows, documented in the project's test playbooks.

## When to Add AI (and When Not To)

Before adding AI to a feature, ask:

1. **Does this problem require natural language understanding?** If the input and output are both structured (e.g., reordering columns, toggling a setting), a deterministic UI interaction is simpler, faster, and more reliable.
2. **Is the AI output verifiable?** The user needs to be able to tell whether the result is correct. If correctness requires domain expertise the user may not have, AI assistance becomes a liability rather than a help.
3. **What happens when the AI is wrong?** If a wrong answer silently corrupts downstream data, the feature needs stronger guardrails or should not use AI at all.

The bar for adding AI to a new surface should be: "this is clearly better with AI than without, and the failure mode is visible and recoverable."

## Contributing

When adding new AI tools or modifying existing ones:

1. Define a Zod schema for the tool's parameters
2. Add the tool to the appropriate file in `studio/src/ai/tools/`
3. Register it in the tool list passed to `generateText()`
4. If the tool modifies canvas state, add config enrichment logic if the LLM is likely to produce a non-standard format
5. Add tests in `studio/src/ai/__tests__/`
6. Update the system prompt in `studio/src/ai/prompts/system.ts` if the model needs guidance on when to use the new tool
