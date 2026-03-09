---
slug: why-we-built-sigilyx
title: "Building SigilYX: A Rust Library for Alteryx's .yxdb Format"
description: "SigilYX is a Rust library with Python bindings that reads and writes Alteryx .yxdb files without requiring an Alteryx installation — 100-200x faster than existing Python alternatives."
authors: [sigilweaver]
tags: [open-source, architecture, philosophy]
---

# Building SigilYX: A Rust Library for Alteryx's .yxdb Format

If you've worked in data analytics for any length of time, someone has probably sent you a `.yxdb` file. Maybe it arrived in a Teams message with the helpful context "here's the data." Maybe it was sitting in a shared drive labeled `final_output_v3_FINAL.yxdb`. Either way, you double-clicked it, nothing happened, and you went back to whoever sent it and asked for a CSV.

`.yxdb` is the native binary format for Alteryx Designer, a visual analytics platform used by tens of thousands of analysts. The files are everywhere in enterprise data teams - workflow outputs, archived datasets, handoffs between departments. And if you're not running Alteryx yourself, they're effectively sealed shut.

I built SigilYX to open them. It's a Rust library with Python bindings that reads and writes `.yxdb` files on any platform - no Alteryx installation, no license, no Windows dependency. `pip install sigilyx`, point it at a file, and you have a Polars DataFrame. In benchmarks it reads files 1.2-2× faster than existing open-source C++ readers and 111-204× faster than the only Python alternative.

This is the story of how it got built - and it starts, unexpectedly, with someone else's generosity.

:::info TL;DR
- **SigilYX is a Rust-based `.yxdb` reader and writer** with Python bindings, supporting all 17 YXDB field types on Windows, macOS, and Linux.
- **Existing open-source readers are Windows-only** and require custom glue code - they target a different use case than what most Python analysts need.
- **SIMD-accelerated UTF-16→UTF-8 transcoding** handles the format's biggest bottleneck, with parallel decompression and column construction for wide schemas.
- **1.2-2× faster than C++ readers, 111-204× faster than pure Python** - benchmarks are fully reproducible with published methodology.
- **A 32.5 GB file (90M rows) processes in 52.6 seconds using 1.1 GB of RAM** - to our knowledge, no other open-source YXDB library supports streaming reads at this scale.
:::

<!--truncate-->

## Standing on the Shoulders of People Who Did the Hard Part

I want to be clear about something upfront: I did not reverse-engineer this format. I never installed Alteryx Designer on a development machine, never used proprietary tools to generate test files, and never signed an NDA. I didn't need to. The format was already open - I just had to know where to look.

The trail starts in May 2015, when Ned Harding - Alteryx's co-founder and former CTO - published a C++ implementation of the `.yxdb` reader on GitHub under GPL-3.0. In an accompanying blog post, he explained that most of the code was the same code Alteryx used internally. The open-sourcing had originally been triggered by GPL license requirements from an R plugin - the YXDB code was embedded in an R plugin, R is GPL-licensed, and GPL requires that derivative works make their source available. Harding decided to give it broader visibility, but was upfront that this was a personal decision, not a corporate one, and that there was no official support from Alteryx. A decade later, the repository has accumulated 24 stars.

Seven years later, on March 9, 2022 - exactly four years ago today - Alteryx themselves published an updated C++ implementation from their official GitHub organization, also under GPL-3.0. In the four years since, that repository has accumulated 5 stars.

I don't think GitHub stars are a meaningful measure of software quality. But 5 stars in four years, for a format used by tens of thousands of analysts, tells you something about the gap between "technically available" and "practically usable." Both C++ implementations were released under GPL - likely motivated at least in part by the R plugin's GPL licensing requirements. They target Windows, produce raw record-level output, and leave you to write your own glue code to whatever framework you actually use. If you're a Python analyst who just wants a DataFrame, the format is open in theory and closed in practice.

And then there's Tom Larsen. Working independently, Larsen built `.yxdb` readers in Python, Go, Java, .NET, and even wrote an ODBC driver - all released under the MIT license. If you wanted to read a `.yxdb` file in any mainstream language before SigilYX existed, Larsen probably had you covered. This is a truly impressive feat, and I am thankful for his work.

SigilYX's format knowledge comes from studying these implementations. The SPECIFICATION.md in the repository cites all seven reference projects with their authors and licenses. The Rust code is an original implementation - no lines were copied - but the understanding of the binary layout, the field type encodings, the compression framing: that all came from reading openly published source code. I'm building on a foundation that Harding, Larsen, and others laid over the past decade.

## Why Build Another One?

If readers already exist in C++, Python, Go, Java, and .NET - why build one in Rust?

Short answer: migration.

I'm building Sigilweaver, a visual data pipeline platform. Its audience includes analysts who currently use - or plan to leave - Alteryx. For those users, migration doesn't start with features or UI comparisons. It starts with data. They have years of `.yxdb` files sitting in shared drives, archive folders, and data pipelines. If Sigilweaver can't read them natively, it's asking analysts to re-export their entire data history before they can even try the product. That's not a migration path - it's a homework assignment.

But there's a less practical reason too. Once I started reading the format specification, I got interested. `.yxdb` is a genuinely well-designed format for mixed-type tabular data. Schema metadata is embedded in the header. Seventeen field types cover everything from booleans to spatial geometries. LZF compression keeps files reasonably sized without slow decompression. There's a reason it's been Alteryx's workhorse format for over a decade - it solves real problems, and it solves them compactly.

Sure, it was designed back before modern columnar formats were ubiquitous - so it misses out on the SIMD-friendly, cache-localized magic we expect today. But analyzing how they squeezed so much efficiency out of a row-based architecture is genuinely impressive.

The format deserved a modern reader. The existing ones are solid but single-threaded, and none of them output directly to a columnar data framework. I figured Rust could close both gaps.

## Reading Someone Else's Binary Format

There's no official `.yxdb` specification document - no PDF, no RFC, no formal grammar. What exists is source code. So the process of building SigilYX was less "implement a spec" and more "read four different implementations in four different languages and figure out what they agree on."

The broad strokes are straightforward. A `.yxdb` file starts with a 512-byte header, followed by XML metadata encoded in UTF-16LE (a detail that will become relevant and annoying shortly), followed by a sequence of LZF-compressed record blocks. The header tells you how many records exist and where the metadata ends. The XML tells you the schema - field names, types, sizes. The compressed blocks contain the actual data.

The details are where it gets interesting.

Each record is a hybrid of fixed-size and variable-length data. Fixed-size fields (integers, floats, booleans, dates) are packed in order with null indicator bytes. Variable-length fields (strings, blobs, spatial objects) store a 4-byte offset in the fixed portion that points into a trailing variable region. Small variable values get a 1-byte length prefix; larger ones get a 4-byte prefix with the high bit set to distinguish format. It's clever - the common case (short strings) is compact, and the rare case (large blobs) still works without a secondary index.

The part that made me laugh was the null handling for booleans. Every other field type uses `0x00` for valid, `0x01` for null - a trailing byte after the value. Booleans? A single byte does triple duty: `0x00` is false, `0x01` is true, `0x02` is null. No null indicator byte. It's the kind of micro-optimization that tells you the format was designed by someone who cared about bytes.

And then there's the UTF-16LE. The XML metadata - the part that tells you what columns the file has - is encoded in UTF-16 Little Endian. In a format designed in the mid-2000s Windows ecosystem, this makes perfect sense. In 2026, it means every reader's first job is to transcode the schema into something the rest of the world uses. This turns out to be one of the more consequential details in the whole format, because it's not just the metadata - string field data is stored in UTF-16LE too.

## The UTF-16 Problem (and the SIMD Solution)

Here's where the engineering challenge lives.

The most common string type in `.yxdb` files from Alteryx is `V_WString` - variable-length, UTF-16LE encoded. When an analyst saves a workflow output, their text columns almost certainly end up as `V_WString`. And every modern data framework - Polars, Arrow, Pandas, everything - uses UTF-8 internally.

So reading a `.yxdb` file means transcoding potentially millions of string values from UTF-16LE to UTF-8. In the existing readers, this is a significant chunk of the total read time. In a naive implementation, it dominates.

But here's the thing: most real-world data is ASCII. Column names, categorical values, addresses, product codes, dates stored as strings - the vast majority of characters in the vast majority of datasets fall in the 0x00-0x7F range. And for ASCII, UTF-16LE to UTF-8 transcoding is trivial: every character is two bytes where the high byte is zero. You're just stripping the zeros.

SigilYX exploits this with an SSE2-accelerated fast path. For chunks of text where every character is ASCII-range, SIMD instructions process 8 characters at a time - check high bytes are zero, shuffle out the low bytes, write them directly. When a non-ASCII character appears, it falls back to a scalar path that handles the full Unicode range correctly. In practice, the fast path handles 95%+ of real data, and what was the biggest bottleneck becomes a non-issue.

## Making It Parallel

Every existing open-source `.yxdb` reader is single-threaded. Open the file, decompress block by block, decode record by record, done. This is perfectly reasonable - the format was designed for sequential access, and single-threaded reading is already fast enough for most use cases.

But "fast enough" leaves a lot of performance on the table when you have 8 or 16 cores sitting idle.

SigilYX parallelizes at two levels. First, decompression: LZF blocks are independent (each is prefixed with its own size header and can be decompressed without any prior block), so after scanning the block boundaries, all blocks decompress concurrently using Rayon. Second, column construction: once the data is decompressed, each column's Arrow array is built on its own thread - one task per column, each independently filling a value buffer and validity bitmap.

The result is that SigilYX's advantage scales with the amount of work available. On a narrow 2-column numeric file, it ties the C++ readers - there's simply nothing to parallelize. On a wide 50-column file with mixed types, it runs 2× faster. On string-heavy data where the UTF-16 transcoding dominates, it's 1.6× faster. The more complex the schema, the more the parallelism pays off.

## The Numbers

100,000 rows, 100 runs, median time:

| Schema | SigilYX (Rust) | Best C++ | Go | .NET | vs best |
|--------|---------------:|---------:|---:|-----:|------------:|
| Narrow (2 cols) | 2.2 ms | 2.2 ms | 4.5 ms | 8.7 ms | 1.0× |
| Numeric (5 cols) | 4.2 ms | 4.3 ms | 7.2 ms | 11.6 ms | 1.0× |
| Mixed (8 cols) | 21.5 ms | 39.9 ms | 130.3 ms | 108.4 ms | 1.9× |
| String-heavy (5 cols) | 52.0 ms | 85.3 ms | 344.6 ms | 204.6 ms | 1.6× |
| Wide (50 cols) | 71.0 ms | 139.6 ms | 439.0 ms | 336.6 ms | 2.0× |

On the Python side, SigilYX's Rust-backed bindings run 111-204× faster than yxdb-py (Tom Larsen's pure-Python implementation). That's not a typo, but it's also not a fair fight. The pure-Python library processes a string-heavy 100K-row file in 10.6 seconds; SigilYX does it in 52 milliseconds. The difference is that SigilYX does all of its work in compiled Rust and hands the result to Python as a finished DataFrame through the Arrow C Data Interface - no row-by-row Python loop, no intermediate copies.

And for the edge case that becomes the whole case in enterprise settings: a 32.5 GB file - 90 million rows - processed in 52.6 seconds using 1.1 GB of peak RAM. Any library that tries to load the entire file will run out of memory on most machines. SigilYX's `scan_yxdb()` streams through it in constant memory. To our knowledge, no other open-source YXDB library supports this.

The full benchmark suite, methodology (510 lines of it), and reproduction instructions are in the repository. If someone wants to challenge the numbers, everything they need is there.

## What I'd Tell Someone Building a Format Reader

A few things I'd do again:

**Start with the test corpus, not the spec.** The Alteryx Community's weekly challenges gave me hundreds of `.yxdb` files with wildly different schemas - narrow numeric tables, wide mixed-type datasets, files with spatial data, files with every edge case in the null-handling logic. Understanding the format by reading code is necessary, but having a diverse corpus of real files is what catches the behaviors that no implementation's source code makes obvious.

**Credit your sources.** Every open-source YXDB reader I referenced is cited in the specification document, with author and license. The format knowledge chain is: Harding's original C++ (GPL-3.0, 2015) → Alteryx's official OpenYXDB (GPL-3.0, 2022) → Larsen's multi-language readers (MIT) → SigilYX (derived specification, original Rust implementation). No black boxes. If someone wants to trace how I know what byte 64 in the header means, the trail is documented.

**Benchmark honestly, and publish the methodology.** If you claim your library is faster, show your work. Run all competitors on the same data, same machine, same conditions. Publish the results, the scripts, and the methodology. Don't cherry-pick the flattering comparisons - SigilYX ties on narrow numeric data, and I report that alongside the 2× wins on wide schemas. Credibility comes from the results you're not bragging about.

---

*SigilYX is open source under AGPL-3.0 and available on [crates.io](https://crates.io/crates/sigilyx), [PyPI](https://pypi.org/project/sigilyx/), and [GitHub](https://github.com/Sigilweaver/SigilYX). It reads and writes files in the `.yxdb` format created by Alteryx. It is not affiliated with, endorsed by, or associated with Alteryx, Inc.*

---

**Discuss on [GitHub](https://github.com/Sigilweaver/Sigilweaver/discussions)** · **Email [contact@sigilweaver.app](mailto:contact@sigilweaver.app?subject=RE:%20why-we-built-sigilyx)** · **Visit [sigilweaver.app](https://sigilweaver.app)**
