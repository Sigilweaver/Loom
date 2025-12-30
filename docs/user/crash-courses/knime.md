---
sidebar_position: 5
---

# Coming from KNIME

If you're a KNIME user, you already understand node-based workflows and the power of visual data science pipelines. Sigilweaver follows a similar paradigm with some differences in scope and approach.

## Terminology Mapping

| KNIME | Sigilweaver | Notes |
|-------|-------------|-------|
| Workflow | Workflow | Both are saved files |
| Node | Tool | Dragged from palette onto canvas |
| Connection | Wire | Links between nodes/tools |
| Port | Socket | Input/output connection points |
| File Reader | Input tool | Load CSV, Parquet, Excel |
| File Writer | Output tool | Save data to files |
| Column Filter | Select tool | Choose columns to keep/remove |
| Row Filter | Filter tool | Keep rows matching condition |
| GroupBy | Summarize tool | Aggregate by groups |
| Joiner | Join tool | Combine two tables |
| Concatenate | Union tool | Stack tables vertically |
| Math Formula | Formula tool | Create calculated columns |
| Sorter | Sort tool | Order rows by columns |

## Common Tasks

### Loading Data

**KNIME:**  
Drag File Reader node → Pick file → Execute → View data

**Sigilweaver:**  
Drag **Input** tool → Pick your file → Click to preview data

### Filtering Rows

**KNIME:**  
Drag Row Filter node → Choose column and condition

**Sigilweaver:**  
Drag **Filter** tool → Write expression like `pl.col("value") > 100` → True/False outputs

**Key difference:** KNIME uses GUI configuration. Sigilweaver uses [Polars expressions](../expressions/basics) - more concise but requires learning syntax.

### Selecting Columns

**KNIME:**  
Drag Column Filter node → Include/exclude columns

**Sigilweaver:**  
Drag **Select** tool → Check columns to keep → Optionally rename, reorder, or cast

### Creating Calculated Columns

**KNIME:**  
Drag Math Formula or Column Expressions node → Build formula

**Sigilweaver:**  
Drag **Formula** tool → Expression: `pl.col("a") + pl.col("b")` → Name output column

### Aggregating Data

**KNIME:**  
Drag GroupBy node → Select group columns → Add aggregations

**Sigilweaver:**  
Drag **Summarize** tool → Set columns to "Group By" → Choose aggregation type (Sum, Mean, Count, etc.)

### Joining Tables

**KNIME:**  
Drag Joiner node → Connect top and bottom inputs → Configure join keys

**Sigilweaver:**  
Drag **Join** tool → Wire left (L) and right (R) inputs → Configure keys → Three outputs: matched (J), unmatched left (L), unmatched right (R)

### Sorting Data

**KNIME:**  
Drag Sorter node → Select columns and sort order

**Sigilweaver:**  
Drag **Sort** tool → Configure columns and ascending/descending order

## Key Differences

### 1. Scope: Data Prep vs. Full Analytics

**KNIME** is a comprehensive analytics platform:
- Machine learning nodes (classification, clustering, etc.)
- Statistical analysis
- Database connectors
- R and Python integration
- Reporting and visualization

**Sigilweaver** focuses specifically on **data transformation pipelines**:
- Extract, transform, load (ETL)
- Data cleaning and preparation
- No ML or stats (yet)

Think of Sigilweaver as doing what KNIME does *before* you get to machine learning - the data wrangling and preparation phase.

### 2. Expression Language

KNIME uses its own expression syntax and visual builders.

Sigilweaver uses **Polars expressions** (Python-like):

```python
# Filter
pl.col("age") > 18

# Formula
pl.col("price") * 1.1

# Conditional
pl.when(pl.col("status") == "active")
  .then(1)
  .otherwise(0)
```

See the [Expressions Guide](../expressions/basics) for complete documentation.

### 3. Execution Model

**KNIME:** Right-click nodes → Execute → Results stored in node → View with output connector

**Sigilweaver:** Lazy evaluation by default:
- Workflow is optimized before execution
- Preview data without executing entire pipeline
- Efficient with large datasets

### 4. Lightweight and Fast

KNIME is Java-based and can be resource-heavy. Sigilweaver is built with:
- **Electron** for Studio (cross-platform desktop)
- **Polars** (Rust) for data processing - extremely fast
- **Python/FastAPI** Server for execution

Sigilweaver is lighter, starts faster, and processes data efficiently.

## Your First Workflow

Let's build a typical KNIME pattern: load data, filter, create a calculated column, and aggregate.

**Steps:**

1. **Load data:**
   - Drag **Input** tool to canvas
   - Pick your CSV file
   - Click to preview

2. **Filter rows:**
   - Drag **Filter** tool, wire from Input
   - Expression: `pl.col("country") == "USA"`
   - Use the **T** (true) output

3. **Calculate discount price:**
   - Drag **Formula** tool, wire from Filter's T output
   - Expression: `pl.col("price") * 0.9`
   - Output column name: `discounted_price`

4. **Aggregate by category:**
   - Drag **Summarize** tool, wire from Formula
   - Set `category` to **Group By**
   - Set `discounted_price` to **Mean**
   - Set `product_id` to **Count**

5. **Save results:**
   - Drag **Output** tool, wire from Summarize
   - Configure format (CSV, Parquet, Excel)
   - Execute workflow

## What's Missing (Compared to KNIME)?

Sigilweaver is focused on data transformation, so it doesn't have:
- Machine learning nodes
- Statistical analysis
- Database connectors (yet - planned)
- R/Python scripting nodes
- Interactive visualizations

If you need those features, KNIME is still your best bet. But for pure **data wrangling and ETL**, Sigilweaver is lighter, faster, and open source.

## Next Steps

- **[Interface Guide](../interface/canvas)** - Learn canvas navigation and shortcuts
- **[Expressions Basics](../expressions/basics)** - Master Polars expression syntax
- **[Tools Reference](../tools/)** - Detailed docs for every tool

If you're comfortable with KNIME's node-based approach, Sigilweaver will feel familiar. The main difference is learning Polars expressions instead of KNIME's GUI builders - but expressions are more powerful and faster to use once you know them.
