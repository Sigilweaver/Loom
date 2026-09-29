# Alteryx workflow import for Sigilweaver Loom: feasibility report

Scope: what Flowfile's Alteryx importer does, how it maps to Loom, the legal picture, a technical plan, and a recommendation. I am not a lawyer; the legal sections are a practical read, not advice.

Repos: FF = /home/user/edwardvaneechoud/flowfile (MIT, Copyright 2024 Edward van Eechoud). LM = /home/user/Loom. Neither was modified.

## 1. What Flowfile's Alteryx import does

### 1.1 Code inventory

Backend (all under FF `flowfile_core/flowfile_core/flowfile/converters/alteryx/`):

| File | Lines | Role |
|---|---|---|
| `yxmd_parser.py` | 256 | XML to `AlteryxWorkflow` (tools, connections, text boxes). Stdlib `xml.etree` only. |
| `convert.py` | 492 | Orchestration: layout, wire resolution, comments, report, YAML dump. `convert_yxmd` at :458. |
| `mappers.py` | 7181 | One mapper per tool. `TOOL_MAPPERS` at :7110, `MACRO_MAPPERS` at :7157, placeholder at :1039/:1060. |
| `expression.py` | 1130 | Alteryx formula to Flowfile formula dialect. `FUNCTION_MAP` :102, `REJECTED_FUNCTIONS` :184, tokenizer :348, parser :502, emitter :715, `try_translate` :1078. |
| `report.py` | 189 | `ToolReportRow`, `ConversionReport`, coverage maths, Markdown table. |
| `scope.py` | 144 | Registry of tools that are deliberately out of scope or no-ops. |
| `yxdb.py` | 259 | `.yxdb` to Parquet, via the third-party `yxdb` PyPI package (MIT, Tom Larsen). |
| `tool_identity.py` | 37 | Canonical tool key (used for telemetry and issue links). |

About 9,700 source lines. Glue: `flowfile_core/routes/converters.py:65` (`POST /converters/alteryx`, multipart, `.yxmd` or `.xml`, 20 MB cap, JWT), and CLI `flowfile import alteryx` in `flowfile/flowfile/__main__.py:240-330` (file or directory, `--inspect`, `--format md|json`).

Frontend (FF `flowfile_frontend/src/renderer/app/`, Vue): `composables/useAlteryxImport.ts` (97), `api/alteryx.api.ts` (94), `features/designer/components/AlteryxImportDialog.vue` (463), `alteryxReport.ts` (137) plus a 358-line vitest file. About 1,150 lines. Entry points: Create menu, empty canvas, welcome screen.

Tests: 563 test functions across 7 files (about 11,150 lines; `test_convert.py` alone is 9,446 lines with 443 tests; `test_expression_translator.py` 57; `test_yxmd_parser.py` 34). 43 hand-written fixture `.yxmd` files (308 KB) plus `fixtures/README.md` describing each. Docs: `docs/users/coming-from-alteryx.md`; design notes in `flowfile_core/CLAUDE.md:23` (one very long paragraph).

### 1.2 Approach

- Parse: `.yxmd` is XML rooted at `<AlteryxDocument>`. `parse_yxmd` (yxmd_parser.py:234) walks `<Nodes>` recursively. Tool containers (`*.ToolContainer`, or any node with `<ChildNodes>`) are flattened: children become ordinary tools, the container itself vanishes (:172-200). `*.TextBox` nodes become comments. Each tool keeps its raw `<Configuration>` element, annotation text, cached output field names and types (`MetaInfo/RecordInfo`), and canvas position. Wires come from `<Connections>` with origin and destination anchor names; `#1/#2` wire names are used to recover Union input order (convert.py:114).
- Strictness: a ToolID that is absent or not a whole number is a hard parse error rather than a guess (yxmd_parser.py:84-120). Zero tools and zero comments is an error.
- Map: `get_mapper` (mappers.py:7170) dispatches on the plugin class name (last segment of `AlteryxBasePluginsGui.Filter.Filter` style strings). Macro nodes carry no plugin name, so they dispatch on the `.yxmc` file basename via `MACRO_MAPPERS`.
- Wire: a generic pass (convert.py:228) translates Alteryx anchors to Flowfile edges through per-tool anchor registries, and reports any wire it cannot place on both of its ends.
- Output: a validated `FlowfileData` object dumped to YAML, then opened through Flowfile's normal import path.

### 1.3 Tools mapped

43 plugin names and 9 shipped macros. Roughly: Text Input, Input Data (file formats only), Output Data, Select, Filter (simple and custom), Formula, Multi-Field Formula, Sort, Summarize, Sample, Unique, Union, Join, Text To Columns, Dynamic Rename, RegEx, Record ID, Transpose, Cross Tab, Append Fields, Running Total, Browse, Date Time, Date Time Now, Generate Rows (numeric or date ranges only), Rank, Field Info, Make Group, Data Cleanse Pro, Pearson correlation, Basic Data Profile, API Output, Map Input; macros Cleanse, Count Records, Random Records, Select Records, Spearman, Field Summary, Imputation, Weighted Average, Create Samples.

Placeholders (no equivalent, listed in the docs): Directory, Join Multiple, Blob Convert, Fuzzy Match, XML Parse, Find Replace, Jupyter Code, Multi-Row Formula, Tile, Blob Input, Make Columns, Multi-Field Binning, Arrange, Dynamic Input, Dynamic Select, Dynamic Replace, JSON Parse, Base64 Encoder, Auto Field, Oversample Field.

### 1.4 Unsupported tools, reporting

Fail-closed by design. Every tool gets one report row with a status: `converted | partial | commented | placeholder | out_of_scope | no_op | skipped` and a `reason` from a closed vocabulary (report.py:20-60). Unsupported tools become a pass-through Python-code node whose body embeds the tool's original `<Configuration>` XML and annotation as comments, so the user can rebuild it without the source file. Spatial, reporting, Calgary, ML, computer-vision and GenAI tools are classed `out_of_scope` (scope.py:27-93); Message/Test/Detour/BlockUntilDone are `no_op` and their wires are carried through. Coverage is reported as two numbers (mapped, and fully converted) computed over in-scope tools only, with annotations excluded. The dialog links a placeholder row to an open GitHub "node request" issue.

### 1.5 Formulas

Flowfile does not go Alteryx-to-Polars directly. It has its own tokenizer, recursive-descent parser and AST for the Alteryx expression language (expression.py:342-700), then emits text in Flowfile's own formula dialect (evaluated by the author's separate `polars-expr-transformer` package, PyPI, license field empty on PyPI). Every result is round-tripped through the real Flowfile parser before it is accepted. About 70 functions are mapped (strings, math, date/time, IIF/Switch, conversions, MD5_UTF8, Base64), with per-function caveats; 8 are explicitly rejected with a reason (Null(), RowCount, GetWord, SpellNumber, Rand, RandInt, MD5_ASCII, MD5_UNICODE). Anything unrecognised is kept as a `//` comment above a stub. Known semantic hazards are handled conservatively (integer-vs-float evaluation, `IN` not translated, regex lookaround refused, output-type declarations mostly ignored).

### 1.6 Connections/inputs, macros, containers, annotations, layout

- Inputs: file paths become read nodes with delimiter/header/sheet options; database connections and credential-bearing paths become placeholders; `.yxdb` inputs are repointed at a Parquet sibling that the user must create with `flowfile convert yxdb`. Headerless CSVs get a rename Select to keep Alteryx's `Field_1..N` names.
- Macros: only the nine shipped macros are mapped by filename. A user macro is a placeholder; its `.yxmc` body is not read. Docs say `.yxmc` and `.yxwz` are "imported for their data tools; control wires and questions are not reproduced". The HTTP route accepts only `.yxmd`/`.xml`; the CLI globs `*.yxmd` only. I found no `.yxzp`/`.yxi` zip handling anywhere in the converter (grep for zipfile, yxzp, yxi: no hits).
- Containers: flattened, no grouping preserved. Comments: text only, colour/font/shape dropped; empty decorative boxes skipped.
- Layout: Alteryx coordinates are shifted to the minimum and scaled by 3.0 (`POS_SCALE`, mappers.py:48; convert.py:82). Without coordinates, a layered left-to-right layout is generated (convert.py:57).

### 1.7 Maturity

High, for a single-maintainer project. Version 0.21.0, last commit 2026-09-26 ("#773", so hundreds of PRs). The clone is shallow (one commit), so history depth cannot be judged locally. Measured coverage claim in the docs: on Alteryx's own 121 "One Tool Example" workflows (923 tools), 82% of in-scope tools mapped, 60% fully converted, 39 of 121 workflows run end to end. That corpus is proprietary and private, so the numbers cannot be reproduced externally. Stated limitations (coming-from-alteryx.md): numbers not checked against Designer, row-order dependence, Fuzzy Match differs, regex dialect differences, AMP-engine `.yxdb` unreadable, comments lose styling, Cross Tab column naming unverified.

### 1.8 Packaging: is it reusable standalone?

No. There is no separate package. The whole repo ships as one PyPI project `Flowfile` (pyproject.toml:2-16 lists flowfile_core, worker, frame, etc. as packages), and the converter is a subpackage of `flowfile_core`. Coupling:

- `yxmd_parser.py` and `tool_identity.py`: pure stdlib, no Flowfile imports. Trivially extractable.
- `report.py` and `scope.py`: light, but import `flowfile_core.schemas.schemas` (report.py:9) and the parser.
- `convert.py`: imports Flowfile's `FlowfileData`, `create_unique_id`, `shared._version`.
- `mappers.py` (7,181 lines): welded to Flowfile's node schemas (`input_schema`, `transform_schema`, `get_all_standard_nodes`, mappers.py:19-34) and to `polars_expr_transformer`.
- `expression.py`: tokenizer/parser/AST are target-neutral (about 350 lines); the emitter and `FUNCTION_MAP` target Flowfile's dialect.

`pip install Flowfile` pulls fastapi, polars, boto3, duckdb, kafka and more, so depending on it as a library is not realistic.

## 2. Mapping to Loom

Loom facts: 13 registered tools in `server/app/domain/tools/register.py`: Input, Output, Filter, Select, Formula, Union, Summarize, Sort, Join, Sample, Unique, Pivot, Unpivot (UI names: Read, Write, Filter, Schema, Calculate, Concatenate, Aggregate, ...; `studio/src/data/tools.ts`). Workflow file is `.swwf` JSON: `{version, meta, tools[{id,type,engine,comment,x,y,config,sockets}], wires[{from:{tool,socket},to:{tool,socket}}], engines}` (`studio/src/domain/workflow/services/WorkflowSerializer.ts:1-30`; Pydantic mirror `server/app/api/models/workflow.py`). Config shapes are documented per tool in `studio/src/data/toolConfigSchemas.ts`. Filter/Formula expressions are Polars Python expression strings (`pl.col('status') == 'active'`), parsed through an AST allowlist (`server/app/utils/expression.py:1-80,170`). Filter has True/False outputs, Unique has U/D, Join has L/J/R, matching Alteryx anchors well. Loom has no macros, no containers, no canvas notes (only a per-tool `comment`), no inline-data input tool, and no explode/split-to-rows.

Important consequence: Flowfile's formula target (its own dialect) is not Loom's target (Polars Python source), so its emitter and mappers cannot be reused, only its knowledge.

| Alteryx tool | Loom equivalent (code name) | Flowfile supports? | Difficulty for Loom |
|---|---|---|---|
| Input Data | `Input` (csv, parquet, xlsx, json, yxdb, qvd, connection) | Yes (files; DB = placeholder; yxdb via Parquet) | Easy-medium (path rewriting, `file.xlsx\|\|\|Sheet` syntax; Loom reads yxdb natively, which is better than Flowfile) |
| Output Data | `Output` | Yes (partial) | Easy-medium |
| Select | `Select` (columnConfigs: rename, targetType, selected) | Yes | Easy |
| Filter | `Filter` (Basic conditions or Custom expression, T/F sockets) | Yes | Easy for Basic; formula-dependent for Custom |
| Formula | `Formula` (operations list, sequential) | Yes | Medium (translator is the work) |
| Join | `Join` (inner/left/right/outer, L/J/R) | Yes | Medium: Alteryx's embedded field select needs an added `Select` after J |
| Union | `Union` (ByName/ByPosition) | Yes | Easy |
| Summarize | `Summarize` (Sum, Mean, Min, Max, Count, CountDistinct, First, Last, Median, Std, Var) | Yes (some as code) | Easy-medium; Concat, Mode, Longest etc. have no Loom action |
| Sort | `Sort` | Yes | Easy |
| Sample | `Sample` (FirstN, LastN, EveryN, Random, RandomPercent, FirstPercent) | Yes (some modes refused) | Easy |
| Unique | `Unique` (First/Strict, U/D) | Yes | Easy |
| Record ID | none; `Formula` with `pl.int_range(...)` | Yes | Easy-medium |
| Multi-Row Formula | none (`shift` in Formula only for simple cases) | No (placeholder) | Hard, needs new tool |
| Multi-Field Formula | none; expand at import into N Formula operations | Yes | Medium |
| Cross Tab | `Pivot` | Yes (partial) | Medium (name mangling, limited aggregates) |
| Transpose | `Unpivot` | Yes | Easy-medium |
| Text To Columns | none; Formula (`str.split`) for columns; rows mode needs explode | Yes | Medium (columns), hard (rows) |
| Data Cleansing | none; Formula operations (strip, case, null fill) | Yes (macro) | Medium |
| Append Fields | `Join` with no keys (cross join, safety-checked) | Yes | Easy-medium |
| Find Replace | none | No (placeholder) | Hard (join plus replace; needs new tool) |
| Browse | none needed (Loom has per-tool data viewer) | Yes (viewer, dropped) | Easy (drop) |
| Text Input | none; no inline-data source | Yes | Medium (write a sidecar CSV, or add an inline-data Input mode) |
| Date Time | `Formula` (`dt.strptime`/`strftime`, format-token translation) | Yes | Medium |
| Generate Rows | none (needs explode/range) | Partial (ranges only) | Hard, needs new tool |
| Tile | none | No | Hard |
| Running Total | `Formula` with `cum_sum().over(...)` | Yes | Medium |
| Weighted Average | `Summarize` plus `Formula` | Yes (macro) | Medium |
| Fuzzy Match | none | No (placeholder with rebuild advice) | Hard, no equivalent |
| RegEx | `Formula` (`str.extract`, `str.replace`, `str.contains`) | Yes (Rust regex limits) | Medium (parse mode ok; tokenize-to-rows hard) |
| Dynamic Input | none | No | No equivalent (runtime-driven) |
| Macro Input / Output | none (no macros in Loom) | No (macro bodies not read) | No equivalent; inline or refuse |
| Tool Container | none | Flattened | Easy (flatten, lose grouping) |
| Comment | per-tool `comment` only | Yes (canvas comment) | Easy but lossy (attach to nearest tool) |

Rough Loom coverage without new tools: about 15 of these 33 convert well, 8 with real work, about 10 need new Loom tools or are unsupportable.

## 3. Legal and licensing (not legal advice)

### 3.1 Flowfile (MIT) into Loom (AGPL-3.0 plus assignment CLA)

- MIT code can be included in an AGPL-3.0 work. The combined work is distributed under AGPL; the MIT notice and copyright line must be kept with the MIT-derived files. That is the whole obligation.
- The CLA (CLA.md section 2.1, 6.1, 6.2) is an assignment from a contributor of their own work. The Loom owner cannot assign Edward's copyright to Sigilweaver Holdings. Copied Flowfile code therefore stays third-party MIT code inside the repo, and the CLA representation of "no third-party rights infringed" is satisfied only if the MIT notice is kept. Practical effect: that code sits outside the poison-pill and relicensing machinery, but MIT is permissive so it does not block the CLA's dual-licence or proprietary-offer language. Keep it in a clearly bounded directory with its own LICENSE file and add an entry to THIRD_PARTY_LICENSES.md (which currently lists only fonts, icons, GSAP, Prism, Docusaurus, Electron, React, Polars, FastAPI, Tailwind).
- Verify separately: `polars-expr-transformer` shows no license on PyPI (Flowfile's own dependency); check its repo before depending on or copying from it. Also check that no third-party code was pasted into Flowfile's importer. The importer's fixture `price_paid.yxmd` is documented as "a real published Alteryx workflow ... origin being confirmed" (fixtures/README.md); do not copy that file.
- Do not import Flowfile's telemetry, node-request, or GitHub-issue plumbing; none is needed.

### 3.2 Options compared

| Option | Legal clarity | Maintenance | Goodwill | Verdict |
|---|---|---|---|---|
| (i) Vendor code + MIT notice | Good (routine) | Bad: 7k-line mapper file welded to Flowfile schemas; constant rebase against a fast-moving upstream | Neutral | Poor fit technically |
| (ii) Depend on it as a package | Good | Not possible today (not published separately; heavy dependency tree) | Good | Only viable if a slim package appears |
| (iii) Clean-room reimplementation using the file format only | Best | You own it; effort is real but mappers must be rewritten for Loom's schema anyway | Neutral to slightly cool | Good default |
| (iv) Shared neutral MIT parser library with Edward | Good if agreed in writing | Shared burden; small surface (parser, formula tokenizer/AST, tool identity, fixtures) | Best | Best if Edward says yes |

Recommendation: start (iii) for the Loom-specific mapper layer (it must be rewritten regardless), and propose (iv) for the target-neutral core. The extractable core is small and already nearly standalone: `yxmd_parser.py` (pure stdlib), the Alteryx formula tokenizer/AST, tool identity, and the hand-written fixtures. If Edward agrees, host it as a tiny MIT package (name neutral, for example `yxmd-parser`), possibly in Sigilweaver's GitHub org next to SigilYX (Apache-2.0, already published) or in his; both projects consume it. If he declines or is silent, do (iii) with no waiting: the XML shape is observable from any user's own file, and Flowfile is then only a reference. If anything is copied, keep the MIT header on those files.

Even under (iii), treat Flowfile's mapper source as a useful checklist of edge cases (its docs and tests record many real Alteryx quirks). Reading MIT code to learn is fine; if you want the cleanest record, have the implementer work from Alteryx's own files and public documentation and log what was consulted.

### 3.3 Alteryx side

- The `.yxmd` is the user's own XML document. Reading a file format to interoperate is generally treated very differently from copying software. I did not find a published Alteryx specification for `.yxmd` in this research, so the format knowledge comes from observing files. Do not copy Alteryx's help text, tool icons, or sample workflows into Loom.
- EULA: Alteryx's Designer EULA may restrict reverse engineering by its licensees. Parsing an XML file a user exports is not decompiling the software, and Loom's users, not Loom, are the licensees. Risk looks low but I have not read the current EULA; have a lawyer confirm that clause.
- Trademark: use "Alteryx" only nominatively and factually ("Import Alteryx workflow (.yxmd)", "compatible with .yxmd files"). No Alteryx logos, no tool icons, no wording implying endorsement. Flowfile's footer is a decent template: "Alteryx is a trademark of Alteryx, Inc. Loom is an independent project and is not affiliated with or endorsed by Alteryx, Inc." Do not name Loom tools with Alteryx's product-branded names beyond describing what they replace.
- SigilYX already reads and writes `.yxdb` (docs/docs/user/tools/input-output/input.md:311), so the interoperability bridge is already crossed.
- Test fixtures: hand-write them (Flowfile does, and has a guard test, `test_fixture_provenance.py`, refusing Designer-saved markers). Alteryx's bundled samples are proprietary; Community Challenge workflows belong to their authors.
- Ask a lawyer about: the EULA clause, whether to state a "not affiliated" notice in-app, whether any Alteryx documentation is quoted in Loom's docs, and the MIT-inside-AGPL-plus-CLA bookkeeping.

## 4. Technical plan for Loom

### 4.1 Where it lives

Server-side Python. Reasons: the parser and formula translator are easiest to test in Python, Loom already has `sigilyx` and `polars` on the server, and a TypeScript rewrite would duplicate the tables. Add `server/app/domain/importers/alteryx/` (parser, mappers, expression translator, report) plus a `POST /api/import/alteryx` route beside `server/app/api/routes/workflow.py`. It returns `{workflow: <.swwf JSON>, report}`. Studio adds an "Import Alteryx workflow (.yxmd)" dialog (a report table like Flowfile's `AlteryxImportDialog.vue`) and opens the result through the existing workflow-load path. A CLI (`loom import alteryx --inspect`) for batch coverage reports is cheap and valuable. Validate file size and use a hardened XML parser (defusedxml) since uploads are untrusted; Flowfile uses stdlib ElementTree.

### 4.2 Reporting unsupported tools

Copy Flowfile's model: per-tool row with status (converted / partial / needs review / placeholder / out of scope / no-op), a closed-vocabulary reason, messages, and coverage numbers over in-scope tools. Because Loom has no code-passthrough node, emit unsupported tools as a `Formula` or `Select` no-op pass-through carrying the original config in `comment`, so the graph stays connected and nothing is silently guessed. Consider adding a generic "Placeholder" tool type so it is visibly marked on the canvas.

### 4.3 Formulas (biggest risk)

Alteryx's expression language (field refs in brackets, `IIF`, `IF/ELSEIF/ENDIF`, `AND/OR/NOT`, case-insensitive functions, `+` for string concat, date functions) needs a real parser. Flowfile shows the right shape: tokenizer, AST, fail-closed emitter, per-function caveat table, and "translate or refuse, never guess". Reuse the design (and, with Edward's agreement, the tokenizer/AST) but write a new emitter targeting Polars Python source that `parse_polars_expression` accepts, for example `Uppercase([x])` to `pl.col('x').str.to_uppercase()`. Validate every output by running Loom's own parser plus a zero-row schema evaluation (as `formula.py:_infer_dtype_from_expression` already does). Expect a long tail: type semantics (Alteryx evaluates in the declared output type), null handling, date format tokens, `IN`, string/number coercion. Refused expressions stay as comments on a pass-through Formula. Optional later step: an opt-in LLM suggestion for refused expressions using Loom's existing AI routes (`server/app/api/routes/ai.py`, `studio/src/components/ai/ExpressionAssist.tsx`), clearly labelled unverified.

### 4.4 Testing

Hand-written fixtures per tool (mirroring Flowfile's 43-file approach), a parametrised function table with expected values on real Polars frames, golden-file report tests, and a provenance guard test. Where an Alteryx workflow states expected values in its comments, assert them. Keep any real-workflow corpus private and skip-if-absent, as Flowfile does. Ask early users to submit sanitised snippets.

### 4.5 Effort (engineer-days, one engineer familiar with Loom)

| Phase | Scope | Days |
|---|---|---|
| MVP | Parser (port or clean-room), route, Studio dialog, report; Input, Output, Select, Filter (Basic plus simple custom), Sort, Union, Join (with select expansion), Unique, Sample, Summarize; layout; comments and containers flattened; tests | 10-15 |
| Good | Formula translator (about 60-70 functions, fail-closed), Formula/Filter custom, Multi-Field Formula expansion, Record ID, Running Total, Transpose, Cross Tab, Append Fields, Text Input (sidecar CSV), Date Time, Data Cleansing, RegEx (parse/match/replace), `.yxzp`/`.yxi` unzip, CLI batch report | 15-22 |
| Great | New Loom tools where gaps hurt (Multi-Row Formula, Text To Columns to rows, Generate Rows, Find Replace, Tile), shipped-macro expansion, user macro inlining from `.yxmc`/`.yxzp`, LLM-assisted refused formulas, corpus-driven tuning | 25-45, open ended |

The estimate for a shared package with Edward (option iv) adds about 3-5 days of coordination and extraction up front and saves on the parser and tokenizer thereafter.

## 5. Bottom line

Technically plausible: yes, for a useful subset. Loom's socket model (Filter T/F, Join L/J/R, Unique U/D) maps closely to Alteryx's anchors, and about half of common Alteryx tools have a workable Loom equivalent. The hard part is the formula language and the missing tools (Multi-Row, Generate Rows, Text To Columns to rows, macros), not the XML. An 80% workflow "skeleton" plus an honest report is achievable in the MVP-to-Good range; full fidelity is not, and Flowfile itself only claims 60% fully converted on Alteryx's own samples.

Legally plausible: yes. MIT to AGPL is compatible with notices; the CLA cannot absorb Edward's code, so keep any borrowed code clearly separate under its own MIT notice. The lowest-risk technical path (clean-room mapper layer, Flowfile as reference) needs no permission, and the best community outcome is a small shared MIT parser package. Have a lawyer review the Alteryx EULA and trademark wording.

What to do first: send Edward a short message before writing code. Suggested text:

"Hi Edward, I maintain Sigilweaver Loom (AGPL-3.0, Polars-based, already reads .yxdb via SigilYX). Your Alteryx importer in Flowfile is impressive, especially the fail-closed formula translator and the report model. We would like to offer .yxmd import in Loom. Two questions: (1) would you be open to extracting the target-neutral core (yxmd_parser.py, the Alteryx formula tokenizer/AST, tool identity and your hand-written fixtures) into a small MIT package that both projects depend on, hosted wherever you prefer, with you as co-maintainer? (2) If not, are you comfortable with us writing our own mapper layer for Loom's schema, using Flowfile's docs and tests as a reference for file-format quirks, with credit in our docs? Either way we will keep your MIT notice on anything we copy and will not use your telemetry or issue plumbing. Happy to share our tool schema so the shared parser exposes what we both need."

In parallel: draft the Loom tool-mapping spec from section 2, decide whether to add an inline-data Input mode and a Placeholder tool, and book the lawyer review.
