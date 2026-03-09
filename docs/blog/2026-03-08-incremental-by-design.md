---
slug: incremental-by-design
title: "Incremental by Design: Why Your Pipeline Shouldn't Start Over"
authors: [sigilweaver]
tags: [architecture, performance, philosophy]
---

# Incremental by Design: Why Your Pipeline Shouldn't Start Over

You change one filter at the end of a twenty-step pipeline. What happens next?

In some tools, the answer is: everything runs again. Every file read, every join, every aggregation. The entire pipeline re-executes from the top, as if nothing had ever been computed before. You wait. You get your result. You realize the filter threshold should be slightly different. You change it. Everything runs again. You wait again.

This is the default behavior of most legacy visual analytics platforms. It's so normalized that people don't even question it. Of course it runs again - you changed something. What else would it do?

It could do what you'd do in a kitchen.

:::info TL;DR
- **Legacy tools recalculate everything** - Change one parameter at the end of a pipeline and every upstream step re-executes from scratch, even if nothing about those steps changed.
- **Sigilweaver reuses what it already knows** - Intermediate results are cached. Changing a downstream tool only recomputes what's actually affected.
- **Lazy evaluation means less waste** - Only the data needed for your current view is computed. Preview five rows and Sigilweaver computes five rows, not five million.
- **External compute separates the thinking from the heavy lifting** - The designer runs on a laptop; the execution engine runs wherever you want. Your analysts don't need workstations.
- **Multi-server routing keeps compute next to the data** - Register servers in AWS, on-premises, or anywhere else. Run workflows where the data lives. No egress fees, no transferring datasets over the internet.
- **Speed changes behavior** - When iteration is cheap, people iterate more. When it's expensive, people batch their changes and hope for the best.
:::

<!--truncate-->

## The Cooking Problem

Imagine you're making dinner. You've spent an hour on a meal: prepped the vegetables, made the sauce, cooked the protein, plated everything. You taste it. Needs more salt.

In the legacy approach, you throw away every dish, go back to the grocery store, buy all the ingredients again, and remake the entire meal from scratch. An hour later, you taste it again. Now it needs pepper. Back to the store.

In the Sigilweaver approach, you pick up the salt shaker.

I know the analogy breaks down with digital things - there's no spoilage, no grocery run, and computation doesn't leave dishes in the sink. But the core claim is real: **you don't have to redo work that hasn't changed.** If the vegetables are already prepped and nothing about how you prep them has changed, prep is done. Move on. Focus on the part that actually needs attention.

That's incremental computation. You modify a step, and only the steps that depend on that modification re-execute. Everything upstream of your change? Already computed. Still valid. Reuse it.

## What Legacy Tools Actually Do

Most legacy visual analytics platforms historically run what I'd call **total re-execution**. You press "Run" and every tool in the pipeline fires, in order, from top to bottom. No caching. No dependency analysis. No concept of "this step's inputs haven't changed, so the output is the same."

This made sense twenty years ago when these architectures were designed. Memory was expensive. Disk was slow. Holding intermediate results in memory for later reuse meant competing for resources with the actual computation. Easier to just run everything fresh and let the OS manage the memory.

But we don't live in that world anymore. Memory is cheap. SSDs are fast. And the data volumes that analysts work with have grown by orders of magnitude. The twenty-minute pipeline that was tolerable in 2008 is a two-hour pipeline in 2026 because the data is a hundred times larger and the architecture hasn't changed.

Here's what that looks like in practice:

1. You open your pipeline. It has thirty tools, four data sources, two joins, and a handful of aggregations.
2. You change a filter expression near the end of the pipeline.
3. You press "Run."
4. All four data sources are re-read from disk.
5. Both joins re-execute on the full datasets.
6. Every intermediate step recalculates.
7. Your filter applies.
8. You wait. Minutes, maybe tens of minutes.
9. Your output looks wrong. You adjust the filter again.
10. Go to step 3.

Every iteration costs the full execution time. It doesn't matter that you only changed one parameter on one tool - the architecture doesn't know how to do anything other than start from the beginning.

Some of these tools have added partial caching over the years. But it's typically opt-in, per-tool, and fragile. It's an afterthought bolted onto an architecture that wasn't designed for it, and it shows.

## What Incremental Means in Practice

Sigilweaver's execution engine was designed from the start around four principles that compound on each other:

**Lazy evaluation.** Nothing computes until something asks for it. Adding a tool to the canvas doesn't trigger execution. Wiring two tools together doesn't trigger execution. Even pressing "Preview" on the last tool in a fifty-step pipeline doesn't execute all fifty steps - it evaluates the minimum subgraph needed to produce the preview and ignores everything else.

If you're previewing five rows of output, Sigilweaver collects only the rows it needs from the final output. Because every intermediate result is a Polars LazyFrame - a logical plan, not materialized data - the engine defers computation until the moment of collection. Combined with aggressive caching of upstream results, a five-row preview at the end of a long pipeline is fast because the upstream work is already cached and the final collection is minimal.

**Aggressive caching.** When a tool does execute, its result is cached. If nothing about that tool's inputs or configuration has changed, the cached result is returned instantly on the next request. This is automatic and transparent - there's no "enable caching" checkbox. It's how the engine works.

Cache invalidation is dependency-aware. Change a tool's configuration and Sigilweaver invalidates that tool and everything downstream of it. Everything upstream stays warm. Change a filter at step eighteen? Steps one through seventeen are cached. Only steps eighteen through twenty re-execute.

**Incremental invalidation.** The engine tracks what changed and what didn't. Modifying one tool in the middle of a pipeline doesn't invalidate everything after it - it invalidates that tool's cache and then checks whether the downstream tools' inputs actually changed. If a filter change doesn't alter the output schema, tools that only depend on the schema (not the data) don't need to re-execute.

**Schema from query plans.** Column names, types, and cardinality estimates come from the logical query plan, not from materializing data. When the AI assistant or a user asks "what columns does this tool output?", the answer is instant because it's derived from the plan. No data needs to move.

These aren't independent features - they're layers of the same design. Lazy evaluation means you only compute what's needed. Caching means you don't compute it twice. Incremental invalidation means changes propagate minimally. Schema from plans means metadata is free. Together, they make iteration cheap.

## The Dinner Test

Go back to the kitchen. You've changed the salt. Does that change how the vegetables were prepped? No. Does it change how the protein was cooked? No. Does it change the sauce recipe? Maybe - if you're adding salt to the sauce. But it doesn't change the vegetables, the protein, or the plating.

The result: changing a filter at the end of a pipeline takes seconds, not minutes. Not because the computer is faster - because it's doing less unnecessary work.

## External Compute: Separating the Canvas from the Engine

There's a related architectural decision that compounds this advantage: **the execution engine doesn't run on your laptop.**

Sigilweaver Studio (the visual designer) is the canvas - it's where you drag tools, wire connections, configure parameters, and preview results. The Server (the execution engine) is where computation actually happens. These are separate processes, and they don't need to be on the same machine.

This means:

**Your analysts don't need expensive workstations.** Studio runs in a browser or a lightweight desktop app. It sends execution requests to the Server and displays results. The heavy computation - joining million-row datasets, running complex aggregations, reading from external databases - happens on the Server.

Put the Server on a beefy machine with plenty of RAM and fast NVMe drives. Give your analysts ultrabooks. They get the same experience whether they're on a top-spec workstation or a thin client, because the laptop isn't doing the work.

**Compute scales independently of headcount.** One powerful server can handle execution for an entire team. Adding an analyst means adding a laptop and a seat, not another workstation. The expensive hardware is shared, and it's the hardware that's actually doing the computation.

**Remote work becomes practical for heavy workloads.** An analyst working from home on a consumer-grade laptop isn't limited by that laptop's specs. They're limited by the server's specs, and the server is sitting in a rack somewhere with hardware that no laptop can match.

In legacy tools, the execution engine and the designer are typically the same process on the same machine. Your laptop is doing the computation. This made sense when the tool was designed as desktop software, but it means your pipeline's speed is capped by whatever hardware you gave to the analyst. Want faster execution? Buy everyone a more expensive computer.

## Multi-Server: Compute Where the Data Lives

The separation between Studio and Server opens a door that matters more than raw performance: **data locality.**

Sigilweaver Hub takes the single-server model and extends it. You can register multiple Server instances - one in your office, one in AWS, one in Azure - and the Hub monitors their health, load-balances across them, and routes workflow execution to whichever server you choose.

Why does this matter? Because data has gravity, and moving it is expensive.

If your datasets live in S3, you can run a Sigilweaver Server on an EC2 instance in the same region. The Server reads directly from S3 over the local network. Your analyst, working from home on their laptop, opens Studio, builds a pipeline, and hits Preview. The execution request goes to the Hub, the Hub routes it to the AWS server, and the server reads the data locally. The only thing that travels over the internet is the execution request and the preview result - a handful of rows. Not the dataset.

**No egress fees.** No downloading a 50GB dataset to a laptop just to filter it. No waiting for a transfer that takes longer than the actual computation.

The legacy approach - where the tool and the engine are the same process on the analyst's machine - means either the analyst downloads the data to their laptop (slow, expensive, potentially a compliance issue) or they VPN into a corporate network and run the tool on a remote desktop (laggy, frustrating). Neither option is good.

With Sigilweaver, the analyst runs Studio locally. It's lightweight - a browser tab or a small desktop app. The heavy lifting happens on a server that's already next to the data. The analyst gets a responsive local UI with the compute power of a server that's co-located with the storage. Their home internet connection only needs to carry configuration payloads and result previews, not raw data.

Multiple servers also mean you can segment by data sensitivity. Production data stays on the on-premises server behind the firewall. Development datasets live on a cloud server for convenience. The Hub routes to the right one. Your analysts don't need to think about infrastructure - they just run their workflows.

## Speed Changes Behavior

Here's the part that's harder to quantify but arguably more important: **iteration speed changes how people work.**

When running a pipeline takes ten minutes, you don't experiment. You think carefully before pressing Run. You batch your changes - adjust three things at once and hope they're all right, because you don't want to wait ten minutes for each one. You avoid exploring your data because exploration means running the pipeline over and over with small variations.

When running a pipeline - or more precisely, recomputing the part that changed - takes seconds, the calculus flips. You experiment freely. You try a filter, preview the result, adjust it, preview again. You explore distributions. You check edge cases. You ask "what if" questions because the cost of asking is negligible.

This isn't a marginal improvement. It's a qualitative change in how analysis gets done. The analyst who waits ten minutes per iteration does three experiments per hour. The analyst who waits two seconds does a hundred. They don't just work faster - they work differently. They find things the first analyst wouldn't, because the first analyst couldn't afford to look.

I built Sigilweaver to be fast for humans. The incremental architecture, the lazy evaluation, the caching - all of it was motivated by the simple belief that a data tool shouldn't make you wait unless there's genuinely new work to do. If the answer is already computed, give it back immediately. If only part of the work changed, only redo that part.

As it turns out, this same architecture is what makes AI assistance practical - a topic I covered in the [previous post](/blog/ai-where-it-belongs). An iterative AI agent needs the same fast feedback loop that a human does. But the motivation was always human ergonomics first. The AI benefits are a bonus.

## The Tax You Don't See

The cost of slow iteration isn't on anyone's balance sheet. Nobody tracks "hours spent waiting for pipelines to re-execute" or "experiments not run because iteration was too slow." It's invisible waste - the analyst who would have caught an anomaly if they'd had time to explore, the insight that never surfaced because re-running was too expensive to justify.

Legacy tools work. They solve real problems. People build real value with them every day. But they carry an architectural tax on every interaction: the cost of recalculating what hasn't changed.

Pick up the salt shaker. Leave the rest of the meal alone.

---

**Discuss on [GitHub](https://github.com/Sigilweaver/Sigilweaver/discussions)** · **Email [contact@sigilweaver.app](mailto:contact@sigilweaver.app?subject=RE:%20incremental-by-design)** · **Visit [sigilweaver.app](https://sigilweaver.app)**
