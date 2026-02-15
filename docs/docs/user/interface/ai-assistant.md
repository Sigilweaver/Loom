# AI Assistant

Sigilweaver includes an optional AI assistant that helps you build and understand data workflows using natural language.

:::warning[Always Review AI Output]
AI-generated workflows may be inaccurate. The assistant can make mistakes about column names, data types, expression syntax, or workflow structure. **Always review the generated tools, wires, and configurations before running a workflow against real data.**
:::

## Enabling the AI Assistant

1. Open the **Settings** tab in the left panel.
2. Under **AI Configuration**, enter your API key and select a provider.
3. Once configured, the **AI** tab appears in the left panel.

## Capabilities

The AI assistant can:

- **Build workflows** — Describe what you want in plain language and the assistant creates the tools, wires, and configuration for you.
- **Add and configure tools** — Ask it to insert inputs, filters, joins, formulas, outputs, and other tools onto the canvas.
- **Write expressions** — Generate Polars expressions for Formula and Filter tools based on a description of what you need.
- **Explain workflows** — Select a workflow and ask "What does this workflow do?" to get a step-by-step explanation.
- **Inspect data** — Ask the assistant to preview schemas, column profiles, and sample rows from any tool output.

## How Results Are Validated

The AI assistant is not a black box. Several layers of validation run automatically to catch mistakes before they reach your workflow:

1. **Schema validation** — Every action the assistant takes (adding tools, creating wires, updating configuration) is validated against strict schemas. Malformed actions are rejected before they touch your workflow.

2. **Compiler checks** — When building multi-step workflows, the compiler validates that all tool types exist, step IDs are unique, and connections reference valid tools and sockets.

3. **Column verification** — The assistant is instructed to always check actual column metadata from your data before writing expressions or configuring tools. It does not invent column names.

4. **Config enrichment** — Filter expressions, join keys, and summarize aggregations are normalized to match the format the execution engine expects, closing the gap between how an LLM describes an operation and how the system executes it.

5. **Iteration limits** — The assistant has a configurable step limit (default: 25) to prevent runaway loops. If more steps are needed, you explicitly choose to continue.

6. **Fully visible actions** — Every tool call is displayed in the chat. You can see exactly what was added, changed, or removed and undo any action.

For more detail on the engineering approach, see the [AI Development Philosophy](/docs/developer/ai-philosophy) in the Developer Guide.

## Using the AI Tab

Click the **AI** tab in the left panel to open the chat interface. Type a message describing what you want, and the assistant will respond with actions and explanations.

### Example Prompts

| Goal | Prompt |
| --- | --- |
| Start from scratch | "Build a workflow that reads a CSV, filters rows where amount > 100, and writes the result to Parquet" |
| Add a step | "Add a Formula tool that calculates total as price * quantity" |
| Understand a workflow | "What does this workflow do?" |
| Fix an expression | "The filter expression is failing — help me fix it" |
| Explore data | "Show me the schema of the Input tool" |

### Tool Calls

When the assistant modifies your workflow it executes **tool calls** — discrete actions like adding a tool, creating a wire, or updating configuration. Each tool call is shown in the chat so you can see exactly what changed.

### Continuing Long Tasks

Complex workflows may require multiple steps. If the assistant reaches its step limit, a **Continue** button appears so you can let it keep working.

## Tips

- Be specific about column names, file paths, and conditions for the best results.
- You can ask follow-up questions — the assistant remembers the conversation context.
- Review generated workflows before running them. The assistant may make assumptions about your data.
- Use the **Workflow** tab to inspect the generated JSON or Python code at any time.

## Debug Mode

For advanced users, debug mode expands tool call details in the chat to show full arguments and results. Toggle it from the AI tab header.
