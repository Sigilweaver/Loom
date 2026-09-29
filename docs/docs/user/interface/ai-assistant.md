---
sidebar_position: 11
title: AI Assistant
---

# AI Assistant

Sigilweaver Loom includes an optional AI assistant that helps you build and understand data workflows using natural language.

:::warning[AI Is Not a Substitute for Understanding Your Data]
The assistant will eventually produce results that are **subtly wrong** - a filter on the wrong column, a join that silently drops rows, an aggregation that looks reasonable but answers a slightly different question than the one you asked. These mistakes pass validation because they are structurally valid; they are just semantically incorrect.

Sigilweaver Loom includes multiple layers of automated validation (schema checks, column verification, config enrichment), but no guardrail catches every mistake. **AI is not a replacement for critical thinking.** Always review the generated tools, wires, and configurations before running a workflow against real data, and verify the output against your expectations.
:::

## Enabling the AI Assistant

1. Open the **Settings** tab in the left pane and expand **AI**.
2. Turn on **Enable AI features**.
3. Choose a **Provider**: OpenAI, Anthropic, Google, Mistral or OpenAI-compatible.
4. Enter your **API Key**. For an OpenAI-compatible provider, also enter its **Base URL**. The key is optional if that server does not need one.
5. Pick a **Model**. The refresh button next to the field loads the provider's model list. You can also type a model name.
6. Use the test button to confirm the connection works.

The **AI** tab then appears next to **Workflow** in the left pane.

Other AI settings:

| Setting                    | Meaning                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------- |
| **Max Agent Iterations**   | The most tool-use steps per turn (1 to 100, default 25).                                  |
| **Expression Assist Model** | Use a different, usually smaller, model for the **AI Assist** buttons in Filter and Calculate. |
| **Post-Turn Audit**        | After each turn, a second model call reviews the work and flags problems. It costs one extra model call per turn. |

## What leaves your machine

You bring your own model provider, and Loom does not run one. Requests go from Studio through the Server's AI proxy to the provider you chose.

To do its job the assistant can read, and therefore send to the provider:

- your workflow's tools, settings and wires,
- column names, types and profile statistics,
- a few sample rows from tool outputs,
- file names found by its file search,
- database table and column names, and rows returned by read-only queries it runs against your connections.

If that data is sensitive, use a provider you are allowed to send it to, or leave the assistant off. Studio stores your API key and the recent chat history on your machine in the app's local storage. The key is not encrypted there, so do not use a key you cannot afford to expose on a shared computer.

:::note Local model servers
The Server's proxy blocks requests to `localhost` and private network addresses as a safeguard against server-side request forgery. An OpenAI-compatible model server on such an address is rejected today. Use an address that resolves to a public IP.
:::

## Capabilities

The AI assistant can:

- **Build workflows** - Describe what you want in plain language and the assistant creates the tools, wires, and configuration for you.
- **Add and configure tools** - Ask it to insert inputs, filters, joins, formulas, outputs, and other tools onto the canvas.
- **Write expressions** - Generate Polars expressions for Calculate and Filter tools based on a description of what you need.
- **Explain workflows** - Select a workflow and ask "What does this workflow do?" to get a step-by-step explanation.
- **Inspect data** - Ask the assistant to preview schemas, column profiles and sample rows from any tool output, or to look at a database schema and run a read-only query.

## How Results Are Validated

The AI assistant is not a black box. Several layers of validation run automatically to catch mistakes before they reach your workflow:

1. **Schema validation** - Every action the assistant takes (adding tools, creating wires, updating configuration) is validated against strict schemas. Malformed actions are rejected before they touch your workflow.

2. **Compiler checks** - When building multi-step workflows, the compiler validates that all tool types exist, step IDs are unique, and connections reference valid tools and sockets.

3. **Column verification** - The assistant is instructed to always check actual column metadata from your data before writing expressions or configuring tools. It does not invent column names.

4. **Config enrichment** - Filter expressions, join keys, and summarize aggregations are normalized to match the format the execution engine expects, closing the gap between how an LLM describes an operation and how the system executes it.

5. **Iteration limits** - The assistant has a configurable step limit (default: 25) to prevent runaway loops. If more steps are needed, you explicitly choose to continue.

6. **Fully visible actions** - Every tool call is displayed in the chat. You can see exactly what was added, changed, or removed and undo any action.

For more detail on the engineering approach, see the [AI Development Philosophy](../../developer/ai-philosophy.md) in the Developer Guide.

## Using the AI Tab

Click the **AI** tab in the left panel to open the chat interface. Type a message describing what you want, and the assistant will respond with actions and explanations.

### Example Prompts

| Goal | Prompt |
| --- | --- |
| Start from scratch | "Build a workflow that reads a CSV, filters rows where amount > 100, and writes the result to Parquet" |
| Add a step | "Add a Calculate tool that calculates total as price * quantity" |
| Understand a workflow | "What does this workflow do?" |
| Fix an expression | "The filter expression is failing - help me fix it" |
| Explore data | "Show me the schema of the Read tool" |

### Tool Calls

When the assistant modifies your workflow it executes **tool calls** - discrete actions like adding a tool, creating a wire, or updating configuration. Each tool call is shown in the chat so you can see exactly what changed.

### Continuing Long Tasks

Complex workflows may require multiple steps. If the assistant reaches its step limit, a **Continue** button appears so you can let it keep working.

## Tips

- Be specific about column names, file paths, and conditions for the best results.
- You can ask follow-up questions - the assistant remembers the conversation context.
- **Review generated workflows before running them.** The assistant may make assumptions about your data that are plausible but wrong. A workflow that runs without errors is not necessarily a workflow that produces correct results.
- Use the **Workflow** tab to inspect the generated JSON or Python code at any time.
- Use undo (`Ctrl+Z`) to reverse a whole assistant turn.
- When in doubt, break complex requests into smaller steps and verify each one before moving on. A five-step conversation that you verify as you go is more reliable than a single prompt that builds everything at once.

## Debug Mode

For advanced users, debug mode expands tool call details in the chat to show full arguments and results. Toggle it with the bug button under the AI tab header. The same row has buttons to export the chat log and to clear the chat history.
