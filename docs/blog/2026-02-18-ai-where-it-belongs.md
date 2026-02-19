---
slug: ai-where-it-belongs
title: "AI Where It Belongs (and Nowhere Else)"
authors: [sigilweaver]
tags: [ai, philosophy, architecture]
---

# AI Where It Belongs (and Nowhere Else)

Every application is getting an AI feature. Most of them shouldn't.

I'm building Sigilweaver with an AI assistant, so I've spent a lot of time thinking about where AI makes a product better and where it makes it worse. The conclusion is simpler than most people want to hear: AI is good at mechanical work. Boilerplate, exploration, translating between representations. It's genuinely useful for tasks that don't require judgment, experience, or institutional knowledge. But it lacks the years of domain expertise, the internal context about *why* your data looks the way it does, the perspective to know when a technically correct answer is practically wrong. AI can help you look at your data faster. It cannot help you *understand* your data.

There's also a prerequisite nobody talks about: your software has to be fast enough for AI to be useful. If every operation the AI tries takes minutes to validate, the AI hasn't saved anyone any time. It's just moved the waiting from the user's hands to the agent's loop.

:::info TL;DR
- **AI is not a core feature** — Sigilweaver is fully functional without it. AI is a convenience layer, not the product.
- **Fast architecture is the prerequisite** — Iterative AI agents only work when each operation takes milliseconds, not minutes. Legacy tools can't support this.
- **The AI cannot output data** — It builds and previews, never executes. Everything it does is reversible. Blast radius: zero.
- **Guardrails catch the easy mistakes** — Structural validation is real but limited. Subtle semantic errors like picking the wrong join type or misreading an ambiguous filter sail right through.
- **AI output should be human-editable** — The agent produces GUI configurations, not raw code. You shouldn't need to learn Polars to fix what the AI got wrong.
- **AI is not a replacement for thinking** — The moment it starts making analytical decisions for you, you've lost the ability to tell when it's wrong.
:::

<!--truncate-->

## The Boilerplate Test

The question I use to decide whether something in Sigilweaver should involve AI:

**Is this task something a machine does effortlessly but a human shouldn't waste time on?**

Most individual operations in Sigilweaver are straightforward. Filters, formulas, joins, aggregations: you can configure them through the GUI without writing code. But building a *workflow* is where the tedium lives. Connecting fifteen tools in the right order, configuring each one, wiring them together, verifying the intermediate results. Each step is easy; the aggregate is time-consuming. It's not intellectually demanding, it's just repetitive assembly work. Tell the agent "read these two CSVs, join them on customer ID, filter where revenue is above 10k, and aggregate by region" and it scaffolds the whole thing in seconds.

But deciding *which* rows to filter? Which columns to aggregate, and what question you're actually trying to answer? That's the user's job. It requires understanding the data, the business context, and the downstream consequences. No model should be making that decision silently.

## Why Architecture Determines Whether AI Is Useful

Whether AI assistance is even *practical* depends almost entirely on the architecture of the software it's embedded in. I don't see this discussed enough.

An AI agent building a workflow is iterative. It adds a tool, checks the schema, previews the output, adjusts the configuration, moves to the next step. A ten-step workflow might involve thirty or forty round trips: adds, previews, metadata checks, corrections. The agent doesn't get it right in one shot. It builds, checks, and adjusts.

This only works if each of those operations is fast.

In Sigilweaver, most operations complete in milliseconds to low seconds. Previewing a tool's output doesn't re-execute the entire workflow from scratch. It evaluates the minimum subgraph needed, pulls the rest from cache, and returns a sample. Schema lookups are instant because column metadata is derived from the query plan, not from running the query. The agent can add a filter, preview five rows to verify it worked, adjust the expression, preview again, and move on, all in the time it takes to read this sentence.

This wasn't an afterthought. Sigilweaver was designed from the start to minimize breaks in flow for human users:

- **Lazy evaluation** — Only compute what's actually needed. A preview of the last tool in a twenty-step pipeline doesn't execute steps whose outputs aren't required.
- **Aggressive caching** — Heavy operations like file reads and joins cache their results. Change a tool downstream? The upstream cache is still warm.
- **Incremental execution** — Modifying one tool in the middle of a pipeline doesn't invalidate everything after it unless the schema actually changed.
- **Schema from query plans** — Column metadata comes from the logical plan, not from materializing data. The agent gets column names and types without running anything.

These are human ergonomics decisions. Dragging a slider or editing an expression should give you feedback in under a second, not after a loading spinner. But they turn out to be exactly what an AI agent needs too. The execution engine is never the bottleneck; the agent's loop runs at the speed of token generation.

Contrast this with legacy visual analytics platforms. In many of these applications, previewing data means re-executing the entire workflow from the top. Every tool runs, every intermediate result is recalculated, even if you only changed one parameter at the end. With large datasets, a single preview can take minutes. Complex workflows with multiple joins and aggregations can take an hour.

Imagine an AI agent trying to work in that environment. It adds a filter. It wants to verify the output. It waits four minutes. The schema looks wrong, so it adjusts the expression. Another four minutes. Thirty iterations of this and the agent has spent two hours on something that should have taken ninety seconds.

This isn't a hypothetical. It's why AI features in legacy analytics tools tend to be one-shot generators rather than iterative agents. The architecture can't support an iterative loop because iteration is too expensive. So they punt: generate the whole workflow in one pass, hope it's right, let the user debug it if it's not.

Legacy tools aren't bad. They solve real problems for real users. But bolting AI onto an architecture that was designed before AI agents existed produces a fundamentally different experience than building AI into an architecture designed for fast, incremental feedback. The speed that makes Sigilweaver pleasant for humans is the same speed that makes it practical for agents.

## The Safety Boundary: Previews, Not Outputs

One more architectural decision matters here, and it's the simplest one: **the AI assistant cannot output data.**

The agent can read schemas, preview rows, profile columns, add tools, wire them together, configure every parameter. But it cannot execute a workflow to produce final output. It cannot write files or push data to a database. Every action it takes is on the canvas, and every canvas action is reversible with Ctrl+Z.

This is deliberate. An AI that can produce output is an AI that can produce *wrong* output that ends up in a production database or a client report. The blast radius is unbounded.

An AI that can only build and preview? The blast radius is zero. The worst case is a misconfigured workflow on a canvas that the user hasn't run yet. You look at it, fix it or delete it, and move on. No data was harmed.

This only works because previews are cheap. If previewing required a full execution run that took ten minutes, you'd be tempted to let the AI run the workflow "for real" just to save time. When previews take milliseconds, there's no pressure to skip the human review step.

There's a related design decision worth mentioning: **the AI produces GUI configurations, not code.** It would have been easier to let the agent emit raw Polars expressions and call it a day. But that creates a problem: if the AI gets something wrong, the user now needs to know Polars syntax to fix it. By constraining the agent to produce the same structured configuration that the GUI uses, everything the AI builds is editable through the same dropdowns, fields, and pickers that a user would use by hand. You shouldn't need to learn a programming language to correct an AI's mistake.

## What Goes Wrong When You Ignore This

The failure mode is predictable: the AI produces something that *looks* right but *is* wrong, and the user doesn't catch it because they trusted the tool.

I watched this happen firsthand while testing Sigilweaver's agent on a Titanic dataset analysis. The user asked: "filter to women and children who did not survive."

The agent did exactly what was asked. It filtered where sex equals female AND age is under some threshold AND survived equals zero. Every condition applied simultaneously. Structurally perfect. Schema validation passed. Compiler was happy. The output was a clean table with reasonable-looking values.

But what the user actually meant was: women *or* children — who survived. "Women and children" is a group, not two independent AND conditions. "Did not survive" described what they wanted to *analyze*, not necessarily filter to. The common English phrasing doesn't map cleanly to logical operators, and the agent picked the literal interpretation over the intended one.

The output looked plausible. The row counts were reasonable. Nothing screamed "this is wrong" unless you already knew what the right answer was and compared.

The spectacular failures are easy to catch. It's the confident, plausible, *almost-right* outputs that get you, the ones where the AI parsed your intent slightly differently than you meant it. Natural language is ambiguous. Logical operators are not. The translation between them is where subtle errors live, and no schema validation will catch them because the query is structurally valid. It just answers a different question than the one in your head.

Every guardrail you add catches one class of error and leaves others untouched. You cannot automate your way to correctness. At some point, a human needs to look at the output and think.

## The Uncomfortable Truth About AI Guardrails

Every AI product talks about guardrails. Ours included: schema validation, column verification, config enrichment, iteration limits. They're real, and they catch a lot of mistakes.

But the mistakes guardrails catch are the *easy* mistakes. Wrong types. Missing fields. Invalid references. If your guardrail is "does this JSON have the right shape," you're catching the errors that a linter catches. The hard errors, wrong column, wrong join type, subtly incorrect filter logic, sail right through because they're perfectly valid operations that happen to answer the wrong question.

Guardrails are seatbelts, not autopilot. They reduce the damage when something goes wrong. They are not a reason to stop paying attention.

## Where AI Actually Earns Its Keep

Given all the caveats, where does AI genuinely help?

**Translating intent to configuration.** "Add a formula that calculates survival rate as survived divided by total" becomes a correctly configured Formula tool with the right expression, wired to the right input. The user expressed the *what*, the agent handled the *how*. The *how* was never the interesting part.

**Reducing the cost of exploration.** When you're new to a dataset, you want to ask quick questions. What columns exist, what the distributions look like, whether two tables share a join key. The agent can scaffold that exploration in seconds. You'd get the same answers by manually adding tools and previewing outputs, but it would take five minutes of clicking instead of one sentence.

**Eliminating the cold-start problem.** A blank canvas is intimidating. You know roughly what you want: read these two files, join them, filter some rows, aggregate, output. Translating that mental model into fifteen configured and wired tools is pure assembly work. The agent handles the scaffolding; you refine the details.

What's not on that list: making analytical decisions, interpreting results, or telling you what your data means. The moment an AI tool starts making those calls for you, you've lost the ability to tell when it's wrong.

## The Meta-Problem With AI Features

The tech industry has a pattern: a new capability appears, and within eighteen months every product has a version of it whether it fits or not. Search got bolted onto everything. Social got bolted onto everything. Crypto got bolted onto everything. (Remember when every company needed a blockchain strategy?) AI is the current iteration.

An AI feature that solves a real problem is valuable. An AI feature that exists because your competitor shipped one is a maintenance burden that erodes trust every time it gives a wrong answer.

For Sigilweaver, that means AI stays in the assistant panel and the expression editor. It doesn't creep into the tool palette, the execution engine, the file browser, or the settings page. If I can't point to a specific mechanical task the AI is eliminating, it doesn't get built.

## The Test I'd Apply to Any Product

Before you add AI to your product:

**What specific mechanical task does this eliminate?** Not "it makes things easier." Name the exact thing the user no longer has to do manually. If the answer is vague, the feature is vague.

**What happens when it's wrong?** If the answer is "the user silently gets incorrect results," you have a problem. If the answer is "the user sees the output and can verify it in ten seconds," you might have something.

**Would better UI solve this instead?** Autocomplete, templates, drag-and-drop, contextual defaults. These are deterministic, testable, and never hallucinate. If any of them solve the problem, they're the better choice.
