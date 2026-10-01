---
sidebar_position: 10
title: Performance and Caching
---

# Performance and Caching

Loom keeps previews fast by caching the results of expensive steps. This page explains what is cached, when a cache is used and how to refresh it.

## What the Server caches

Most tools stream data, so they need no cache. Some operations must read all their input first ("blocking" operations). The Server saves their results to disk as Parquet files.

| Cached                                   | Why                                                     |
| ---------------------------------------- | ------------------------------------------------------- |
| **Sort**                                 | Must see every row to fix the order.                    |
| **Aggregate** (`Summarize`)              | Must see every row in a group.                          |
| **Join**                                 | Must compare both sides.                                |
| **Unique**                               | Must track values across all rows.                      |
| **Pivot**                                | Must scan all rows to find the new column names.        |
| **Sample**, in some modes                | Last N, Random, Random Percent and First Percent need a full scan. |
| **Read**, for databases                  | Avoids running the same query again.                    |

Not cached: Read for files (Polars scans them lazily), Filter, Schema, Calculate, Concatenate, Unpivot, and Sample in First N or Every N mode.

Studio marks blocking tools with a warning triangle. The Server decides what is cached; Sample and Read caching also depend on their configuration.

## When a cache is used

Each cached result is stored under a fingerprint of the tool's settings and its upstream tools' fingerprints. If you change a tool, its fingerprint and every downstream fingerprint change, so those results are recomputed. Anything upstream that did not change keeps its cache.

:::caution Changes on disk are not detected
The fingerprint does not include the contents of your source files or database. If a file or table changes outside Loom, cached results stay in use until you refresh (see below).
:::

### Example

```
Read CSV -> Sort -> Filter -> Schema -> Write
```

- **Edit the Filter.** Sort still has a valid cache and is skipped. Filter and Schema are recomputed for previews; Write runs only when you choose Run.
- **Edit the Sort.** Sort changes, so everything after it runs again. The new Sort result is cached.
- **Edit the CSV file on disk.** Nothing notices. Sort keeps serving its old result until you refresh.

## Refreshing

Use the arrow next to **Preview All** in the header:

- **Bypass Cache** makes previews ignore cached results while it is checked. The button label changes to `Preview All*`.
- **Clear Backend Cache** deletes the Server's cached files for this workflow.

Do this when a database changed, or when you suspect a stale result. Studio also keeps its own short-lived cache of previews. Changing a tool or a wire clears the affected entries, and closing a workflow clears them all.

## Where cache files live

Cache files are on the machine that runs the Server. With the bundled Server, that is your own machine, in the app's data directory. With a remote Server or Hub, they are on that Server.

The Server removes cache files when:

- you close the workflow in Studio (default),
- a file is older than the retention period (7 days by default),
- the cache exceeds its size limit (20 GB by default), oldest files first,
- you clear the cache.

Administrators can change these limits. See [Server Configuration](../../admin/server-configuration.md#cache).

## Performance tips

1. **Reduce data before expensive steps.** Filter and select before you sort, join or aggregate.

   ```
   Slower:  Read -> Sort -> Filter
   Faster:  Read -> Filter -> Sort
   ```

2. **Filter both sides of a join first.** A join on large inputs is expensive.
3. **Choose formats deliberately.** Parquet and Arrow IPC read faster than CSV. Excel, Avro, ODS, YXDB, QVD and standard JSON load entirely into memory.
4. **Expect a trade-off while developing.** Filtering early makes runs faster. Filtering late means fewer cache misses while you edit upstream tools.

## Troubleshooting

**The preview looks stale.** Choose **Bypass Cache** or **Clear Backend Cache**, then preview again.

**Editing is still slow.** The cache helps only when you edit downstream of a cached step. Editing a tool upstream of a Sort or Join recomputes it.

**Disk space is growing.** Each open workflow has its own cache. Close workflows you are not using, or clear the cache.
