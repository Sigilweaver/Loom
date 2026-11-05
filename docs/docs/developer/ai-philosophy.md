# AI Development Philosophy

This document describes how AI features are designed, validated, and constrained in Sigilweaver Loom. The goal is to make AI genuinely useful for building data workflows while keeping the user firmly in control.

## AI Is Not a Core Feature

Sigilweaver Loom is a visual data pipeline platform. The AI assistant is a convenience layer on top of that platform - it is not the product itself. Every workflow the assistant builds can be built by hand, and the application is fully functional without AI enabled.

This distinction matters for development decisions. AI should be applied where it provides clear, measurable value - eliminating boilerplate that machines handle effortlessly but humans shouldn't waste time on, translating natural language to expressions, explaining unfamiliar workflows. It should **not** be applied to problems that are better solved by good UI design, clear documentation, or deterministic logic. If a feature works reliably without AI, adding AI to it is not an improvement.

## Core Principles

### The user is always in charge

AI is **opt-in and off by default**. No AI features activate until the user explicitly configures a provider and API key. Every action the assistant takes is visible in the chat log, and every change it makes to the canvas can be undone with Ctrl+Z.

### Assist, don't replace

The assistant builds workflows using the same tools, wires, and configurations a user would create by hand. It does not introduce hidden logic, custom code blocks, or opaque transformations. If you can't build it manually in the tool palette, the AI can't build it either.

This also means we do not gate basic functionality behind AI. A user who never enables AI should never feel like they are missing core capabilities.

### Validate at every layer, but know the limits

LLM outputs are inherently probabilistic. Rather than hoping the model gets it right, we validate at every layer. But validation catches _structural_ errors - malformed schemas, missing fields, invalid connections. It does not catch _semantic_ errors like filtering on the wrong column, choosing the wrong join type, or misinterpreting an ambiguous request. No amount of guardrails eliminates the need for the user to review what the assistant produced.

The validation layers:

| Layer | What it catches |
| --- | --- |
| **Zod schemas** | Malformed tool call arguments - wrong types, missing fields, extra properties |
| **Compiler** | Unknown tool types, duplicate IDs, invalid connections between steps |
| **Config enrichment** | Expression format mismatches (e.g., join key arrays, filter operation structures, aggregation shapes) |
| **Column metadata checks** | The system prompt instructs the agent to always query actual column names before writing expressions - never invent them |
| **Self-check** | `validate_workflow` runs Studio's structural checks and a Server preview of every tool; the prompt tells the agent to call it before finishing |
| **Approval** | With "Ask before destructive edits" on (default), removing tools or replacing a non-empty canvas waits for the user |
| **Iteration cap** | Runaway loops are stopped at a configurable step limit (default: 25) |

### Transparency over magic

Every tool call the assistant executes is rendered inline in the chat. Users see the tool name, arguments (in debug mode), and result summary. There is no hidden state - what you see in the chat is what happened on the canvas.

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
Tool calls --> Zod schema validation --> Tool execution
    |                                         |
    v                                         v
Streaming response                   Canvas state mutations
    |                                    (addTool, addWire,
    v                                     updateTool, etc.)
Chat UI
```

### Provider agnostic

The assistant works with OpenAI, Anthropic, Google, Mistral and any server that implements the OpenAI Chat Completions API. Provider selection, model choice, and API keys are configured by the user. All API traffic routes through the Server's proxy (`/api/ai/proxy/{provider}`) to avoid CORS issues; for OpenAI-compatible servers Studio names the upstream in the `x-loom-upstream-base-url` header.

### Structured tool calling

The assistant communicates with the canvas exclusively through a fixed set of tools, registered in `AGENT_TOOLS` in `studio/src/ai/agent.ts`:

**Canvas mutation:**
- `add_tool` / `insert_tool_between` / `remove_tool` - Add, splice into a wire, or remove a tool
- `update_tool` / `update_tools` / `patch_tool_config` - Replace, batch-update or patch config fields by path
- `connect_tools` / `disconnect_tools` - Wire management
- `batch_canvas_ops` - Several adds, connects, updates and removes in one call with cross-references

**Reading and checking:**
- `get_tool_config` - A tool's full config and connections (the canvas summary in the prompt truncates long values)
- `get_tool_config_schema` - Every config field of a tool type
- `validate_workflow` - Structural checks plus a Server preview of every tool
- `preview_tool_output` / `get_column_metadata` / `profile_tool_data` - Read and profile data from tool outputs

**Files and databases:**
- `list_available_files` / `search_files` - Browse and search the data directory
- `list_database_connections` / `describe_schema` / `query_database` - Read-only database discovery

**Workflow building:**
- `build_workflow` - Compile a multi-step workflow description in one shot

**User interaction:**
- `ask_user` - Present clarifying questions with optional predefined choices

Every tool is wrapped by `guardTools` (`studio/src/ai/loop.ts`): results over 12,000 characters are truncated with a note, and a tool that throws returns `{ error }` to the model instead of failing the turn.

Each tool has a Zod schema that validates the LLM's arguments before execution. If validation fails, the error is returned to the model so it can self-correct.

### Config enrichment

LLMs often produce configurations that are _semantically_ correct but _structurally_ different from what the execution engine expects. The enrichment layer normalizes these:

- **Filter** - Builds the Polars expression and the Basic-mode condition tree from `{ column, operator, value }` conditions (with optional `groups`), escaping quotes in values
- **Formula** - Resolves structured operations (`operationId`, `sourceColumn`, `params`) through the formula catalog and normalizes raw `{ column_name, expression }` operations
- **Join** - Lower-cases `joinType` and drops empty `leftKeys`/`rightKeys` so the panel shows the join as unconfigured instead of a cross join
- **Summarize** - Builds the panel's `actions` list from `groupByColumns` and `aggregations` and normalizes operation names (`sum` to `Sum`)

This runs on every config the agent writes: `add_tool`, `insert_tool_between`, `update_tool`, `update_tools`, `patch_tool_config`, `batch_canvas_ops` and `build_workflow`. Tool types also accept the canvas display names ("Aggregate" for Summarize), and a tool added after a Join connects from `output-match`.

## Behavioral Constraints

The system prompt encodes explicit rules the model must follow:

1. **Always check column metadata** before writing column-dependent expressions. Never invent column names.
2. **Always search for files** before referencing file paths. Never guess paths.
3. **Build reproducible pipelines** - results must be computable from the workflow, not from the model doing mental arithmetic.
4. **Handle errors gracefully** - if a preview fails, read the error, adjust the configuration, and retry.
5. **Remind the user to review** - the model is instructed to note that AI-generated workflows should be reviewed for accuracy.
6. **Ask before assuming** - when the user's request is ambiguous, the model should ask a clarifying question rather than guessing. Getting it wrong and rebuilding wastes more time than a one-question pause.

## Safety Measures

| Measure | Description |
| --- | --- |
| **Disabled by default** | AI features require explicit opt-in |
| **Sample data is opt-in** | With "Share sample data" off (default), previews, query results and value statistics are withheld from the model; names, types and counts are always sent |
| **API key storage** | Keys are kept in the app's local storage on the device (not the OS keychain) and sent to the Server proxy with each request |
| **Private upstreams refused** | The proxy refuses private and loopback addresses unless the operator lists the origin in `AI_ALLOWED_PRIVATE_UPSTREAMS` |
| **Hop-by-hop header stripping** | The proxy strips `origin`, `referer`, `proxy-authorization`, and other sensitive headers before forwarding to the LLM provider |
| **Request timeouts** | 300-second upstream timeout; 15-second timeout for model listing |
| **Abort support** | Users can cancel generation at any time via the stop button |
| **Context window management** | Token-budgeted history packing (~60k tokens) trims older messages; large canvases (summary over 12,000 characters) are summarized without configs; tool results are capped |
| **Prompt caching** | On Anthropic, the stable system prompt and the newest message carry cache breakpoints, so multi-step turns reread the conversation from cache |
| **Turn undo** | Each turn that changed the canvas records one history step and a change summary in the chat with an Undo for that turn |
| **Per-tab isolation** | Each tab has its own chat session, run queue, and cancel semantics |
| **Canvas write guard** | Agent tool calls verify tab ownership before mutating the canvas, preventing cross-tab writes |
| **Streaming proxy** | Server proxy preserves SSE streaming end-to-end for progressive token display |
| **Error classification** | Errors are categorized from the HTTP status (auth, rate-limit, network, overloaded, missing model, context length) with user-friendly messages |
| **Lazy loading** | AI SDK modules are only imported when AI is enabled - non-AI users pay zero bundle cost |

## Testing

AI features are covered by unit tests and an offline eval suite:

- **Agent evals** (`studio/src/ai/__tests__/evals/`) - A scripted model (`studio/src/ai/evals/harness.ts`, built on the AI SDK's `MockLanguageModelV4`) drives the real agent loop, tools and stores against a fake Server. Script steps can be functions of what the model was sent, so scenarios assert both on the canvas and chat the user ends up with and on what reached the model (for example that sample values were withheld). Add a scenario when changing loop behaviour.
- **Tool contract drift tests** - `server/tests/test_ai_tool_contract.py` snapshots the Server's tool config models, accepted enum values and allowed Polars names into `studio/src/ai/__fixtures__/serverToolContract.json` and fails when the snapshot is stale. `studio/src/ai/__tests__/toolContract.test.ts` checks `toolConfigSchemas.ts`, the prompt's config examples (`prompts/toolReference.ts`) and the formula catalog against it. Regenerate with `UPDATE_TOOL_CONTRACT=1 uv run pytest tests/test_ai_tool_contract.py` from `server/`.
- **Tool registry checks** - Every tool name the system prompt or a tool description mentions must be registered.
- **Compiler, prompt, provider, enrichment, loop and safety tests** - Spec compilation and socket validation, prompt assembly, request shape per provider, config normalization, result capping, approvals, data sharing and turn undo.

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
3. Register it in `AGENT_TOOL_DEFS` in `studio/src/ai/agent.ts`
4. If the tool modifies canvas state, add config enrichment logic if the LLM is likely to produce a non-standard format
5. If it removes or replaces user work, call `requestApproval` (`studio/src/ai/approval.ts`) first; if it returns data values, pass them through `studio/src/ai/dataSharing.ts`
6. Add tests in `studio/src/ai/__tests__/`, and an eval scenario if it changes how a turn plays out
7. Update the system prompt in `studio/src/ai/prompts/system.ts` if the model needs guidance on when to use the new tool
