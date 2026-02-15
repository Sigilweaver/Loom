# AI Development Philosophy

This document describes how AI features are designed, validated, and constrained in Sigilweaver. The goal is to make AI genuinely useful for building data workflows while keeping the user firmly in control.

## Core Principles

### The user is always in charge

AI is **opt-in and off by default**. No AI features activate until the user explicitly configures a provider and API key. Every action the assistant takes is visible in the chat log, and every change it makes to the canvas can be undone with Ctrl+Z.

### Assist, don't replace

The assistant builds workflows using the same tools, wires, and configurations a user would create by hand. It does not introduce hidden logic, custom code blocks, or opaque transformations. If you can't build it manually in the tool palette, the AI can't build it either.

### Validate at every layer

LLM outputs are inherently probabilistic. Rather than hoping the model gets it right, we validate at every layer:

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

The assistant communicates with the canvas exclusively through a fixed set of tools:

- `add_tool` / `remove_tool` / `update_tool` — Modify the canvas
- `add_wire` / `remove_wire` — Connect tools
- `build_workflow` — Compile a multi-step workflow description in one shot
- `preview_tool_output` / `get_column_metadata` / `profile_tool_data` — Read data
- `search_files` — Discover available files
- `get_tool_schema` — Look up configuration schemas

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

## Safety Measures

| Measure | Description |
| --- | --- |
| **Disabled by default** | AI features require explicit opt-in |
| **No credential storage in browser** | API keys are sent to the server proxy per-request |
| **Hop-by-hop header stripping** | The proxy strips `origin`, `referer`, `proxy-authorization`, and other sensitive headers before forwarding to the LLM provider |
| **Request timeouts** | 300-second upstream timeout; 15-second timeout for model listing |
| **Abort support** | Users can cancel generation at any time via the stop button |
| **Context window management** | Chat history is capped at 40 messages to prevent context overflow errors |
| **Lazy loading** | AI SDK modules are only imported when AI is enabled — non-AI users pay zero bundle cost |

## Testing

AI features are covered by unit tests:

- **Compiler tests** — Valid compilation, unknown tool types, duplicate IDs, invalid connections, UUID generation, socket injection, auto-layout, config merging
- **Prompt construction tests** — System prompt assembly with dynamic context
- **Provider tests** — Provider abstraction and model resolution

Integration-level testing is done through manual agent sessions with representative workflows, documented in the project's test playbooks.

## Contributing

When adding new AI tools or modifying existing ones:

1. Define a Zod schema for the tool's parameters
2. Add the tool to the appropriate file in `studio/src/ai/tools/`
3. Register it in the tool list passed to `generateText()`
4. If the tool modifies canvas state, add config enrichment logic if the LLM is likely to produce a non-standard format
5. Add tests in `studio/src/ai/__tests__/`
6. Update the system prompt in `studio/src/ai/prompts/system.ts` if the model needs guidance on when to use the new tool
