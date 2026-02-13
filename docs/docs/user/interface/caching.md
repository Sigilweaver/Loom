---
sidebar_position: 7
---

# Performance & Caching

Sigilweaver uses intelligent caching to keep your workflow responsive, especially when working with large datasets.

## How Caching Works

When you're building a workflow, Sigilweaver remembers the results of expensive operations. If you edit a tool, only the changed parts of your workflow need to re-run.

### What Gets Cached

These operations are automatically cached because they need to process all your data before producing results:

| Operation | Why It's Cached |
|-----------|-----------------|
| **Sort** | Must scan all rows to determine the final order |
| **Summarize** | Must see all rows in each group to calculate totals |
| **Join** | Must compare both datasets to find matches || **Unique** | Must track seen values across all rows |
| **Pivot** | Must scan all rows to determine column headers |
| **Sample** (some modes) | Last N, Random, Random Percent, and First Percent require full scan || **Database Input** | Avoids repeated queries to your database server |

### What Doesn't Get Cached

Streaming operations like **Filter**, **Select**, **Formula**, **Union**, and **Unpivot** don't need caching - they can process data row-by-row without seeing everything first. **Sample** in First N or Every N mode is also streaming.

## Example: Editing Downstream

Consider this workflow:

```
CSV Input → Sort by Date → Filter → Select Columns → Output
```

**Scenario 1: You edit the Filter**

1. CSV Input: [SKIP] No re-read needed (Polars streams from disk)
2. Sort: [CACHE HIT] The sort result is reused
3. Filter: [RE-RUN] Re-runs with your new filter condition
4. Select: [RE-RUN] Re-runs (downstream of changed tool)
5. Output: [RE-RUN] Re-runs

**Result**: The expensive Sort operation is skipped entirely.

**Scenario 2: You edit the Sort**

1. CSV Input: [SKIP] No re-read needed
2. Sort: [RE-RUN] Re-runs with your new sort order
3. Filter: [RE-RUN] Re-runs (receives new sort output)
4. Select: [RE-RUN] Re-runs
5. Output: [RE-RUN] Re-runs

**Result**: Since Sort changed, everything downstream re-runs, and the new Sort result is cached for next time.

## When to Force a Refresh

Sometimes you need to bypass the cache:

- **Database data changed**: Your source data was updated externally
- **Debugging issues**: You want to ensure you're seeing fresh results

### How to Refresh

When previewing a tool, use the **Refresh** option to clear the cache and re-execute the entire upstream chain. This is available in the preview panel for tools connected to database inputs.

:::note
Refreshing clears the cache for the entire workflow, not just one tool. This ensures consistency when upstream data has changed.
:::

## Performance Tips

### 1. Filter and Select Before Expensive Operations

Always reduce your data volume BEFORE sorting, joining, or summarizing:

```
SLOWER:  Input → Sort → Filter
FASTER:  Input → Filter → Sort
```

This is the single most important optimization - expensive operations work on less data.

### 2. Minimize Data in Joins

Filter both sides of a join before joining:

```
SLOWER:  Large Dataset A → Join → Large Dataset B
FASTER:  Large Dataset A → Filter → Join → Large Dataset B → Filter
```

### 3. Consider the Development vs. Production Trade-off

When building workflows, there's a trade-off to consider:

**Filtering early** (before expensive operations):
- Better runtime performance - expensive operations process less data
- Ideal for production workflows that run repeatedly
- May cause more cache misses during development when editing upstream filters

**Filtering later** (after expensive operations):
- Slower runtime - expensive operations process more data
- Better cache reuse when iterating on downstream tools during development
- Less efficient for production use

Both approaches have merits depending on your use case. The cache is transparent - it works regardless of your workflow structure.

## Cache Location

Cached data is stored locally on your machine in the application's cache directory. Cache files are automatically cleaned up when:

- You close a workflow
- You modify upstream tools (invalidating stale caches)
- The application starts (cleaning orphaned files)

:::info Privacy
Cache files never leave your machine. They're stored as Parquet files (a compressed columnar format) in your local application data directory.
:::

## Troubleshooting

### "My preview seems stale"

Use the Refresh option in the preview panel to force re-execution. This is especially useful after:
- Modifying source files externally
- Database schema changes
- Reconnecting to a database

### "Execution is slow even with caching"

Check if you're editing a tool that's upstream of expensive operations. The cache can only help when you're editing *downstream* of cached results.

### "Disk space is growing"

Each workflow maintains its own cache. If you're working with very large datasets, caches can consume significant disk space. Closing workflows you're not actively using will clean up their caches.
