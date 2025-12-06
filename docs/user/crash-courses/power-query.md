---
sidebar_position: 4
---

# Coming from Power Query

If you're used to Power Query (in Excel or Power BI), you understand the value of repeatable data transformations. Sigilweaver brings similar power with a visual canvas and more flexibility.

## Terminology Mapping

| Power Query | Sigilweaver | Notes |
|-------------|-------------|-------|
| Query | Workflow | Saved transformation pipeline |
| Step | Tool | Individual transformation operation |
| Applied Steps | Workflow canvas | Visual representation of all steps |
| Source | Input tool | Load data from files |
| Table output | Output tool | Save transformed data |
| Filter Rows | Filter tool | Keep/remove rows by condition |
| Choose Columns | Select tool | Select, rename, reorder columns |
| Group By | Summarize tool | Aggregate by groups |
| Merge Queries | Join tool | Combine two tables |
| Append Queries | Union tool | Stack tables vertically |
| Add Column (Custom) | Formula tool | Create calculated columns |
| Sort | Sort tool | Order rows |

## Common Tasks

### Loading Data

**Power Query:**  
Data → Get Data → From File → Select file → Transform Data

**Sigilweaver:**  
Drag **Input** tool → Pick your file → Preview data

### Filtering Rows

**Power Query:**  
Click column header dropdown → Filter values OR Home → Remove Rows → Custom Filter

**Sigilweaver:**  
Drag **Filter** tool → Write expression like `pl.col("sales") > 1000` → Use T (true) output

**Key difference:** Power Query uses clickable filters. Sigilweaver uses [Polars expressions](../expressions/basics) - more powerful but requires learning syntax.

### Selecting/Removing Columns

**Power Query:**  
Right-click column → Remove OR Choose Columns button

**Sigilweaver:**  
Drag **Select** tool → Check columns to keep → Configure rename/reorder/casting

### Creating Calculated Columns

**Power Query:**  
Add Column → Custom Column → Enter M formula like `[Price] * [Quantity]`

**Sigilweaver:**  
Drag **Formula** tool → Expression: `pl.col("price") * pl.col("quantity")` → Name output column

### Grouping and Aggregating

**Power Query:**  
Group By → Choose group columns → Add aggregations

**Sigilweaver:**  
Drag **Summarize** tool → Set columns to "Group By" → Choose aggregation (Sum, Mean, Count, etc.) for each metric

### Merging Queries (Joins)

**Power Query:**  
Home → Merge Queries → Select second table → Choose columns → Select join kind

**Sigilweaver:**  
Drag **Join** tool → Wire left (L) and right (R) inputs → Configure join keys → Outputs: J (matched), L (left only), R (right only)

### Appending Queries (Union)

**Power Query:**  
Home → Append Queries → Select tables to stack

**Sigilweaver:**  
Drag **Union** tool → Wire multiple inputs → Stack vertically

## Key Differences

### 1. M Language vs. Polars Expressions

Power Query uses **M language** for custom operations:
```m
= [Sales] * 1.1
= if [Status] = "Active" then [Price] else 0
```

Sigilweaver uses **Polars expressions** (Python-like syntax):
```python
pl.col("sales") * 1.1

pl.when(pl.col("status") == "Active")
  .then(pl.col("price"))
  .otherwise(0)
```

The [Expressions Guide](../expressions/basics) has everything you need to learn Polars syntax.

### 2. Visual Canvas vs. Applied Steps List

Power Query shows steps as a **linear list** in the right panel. You edit by clicking steps.

Sigilweaver shows your workflow as a **visual graph** on the canvas:
- See branches and merges spatially
- Understand complex pipelines at a glance
- Wire tools together like a flowchart

### 3. No Excel Dependency

Power Query lives inside Excel (or Power BI). Sigilweaver is a **standalone desktop application**:
- Runs on Windows, macOS, and Linux
- No Excel license required
- Processes data without loading into spreadsheet cells
- Handles datasets far larger than Excel's row limits

### 4. Lazy Evaluation

Power Query evaluates steps when you click "Close & Load." Sigilweaver uses **lazy evaluation**:
- Workflow is optimized before execution
- Preview data without executing entire pipeline
- Efficient handling of large datasets

## Your First Workflow

Let's replicate a common Power Query task: load sales data, filter for current year, calculate profit margin, and group by region.

**Steps:**

1. **Load data:**
   - Drag **Input** tool to canvas
   - Pick your CSV file
   - Click tool to preview

2. **Filter for current year:**
   - Drag **Filter** tool, wire from Input
   - Expression: `pl.col("year") == 2024`
   - Use the **T** (true) output

3. **Calculate profit margin:**
   - Drag **Formula** tool, wire from Filter's T output
   - Expression: `(pl.col("revenue") - pl.col("cost")) / pl.col("revenue") * 100`
   - Output column name: `profit_margin`

4. **Group by region:**
   - Drag **Summarize** tool, wire from Formula
   - Set `region` to **Group By**
   - Set `revenue` to **Sum**
   - Set `profit_margin` to **Mean**

5. **Save results:**
   - Drag **Output** tool, wire from Summarize
   - Choose format (Excel, CSV, Parquet)
   - Pick output location and execute

## Why Switch from Power Query?

- **Handle larger datasets** - No row limits, processes data in streaming fashion
- **Faster performance** - Polars is built in Rust, optimized for speed
- **Visual complexity** - See branching workflows, multiple outputs, complex joins spatially
- **Cross-platform** - Works on any OS, no Excel needed
- **Open source** - Free, AGPL-licensed, community-driven

## Next Steps

- **[Interface Guide](../interface/canvas)** - Learn the canvas, tool palette, and wiring
- **[Expressions Basics](../expressions/basics)** - Master Polars expressions (like M language, but Python-based)
- **[Tools Reference](../tools/)** - Detailed documentation for every tool

If you're comfortable with Power Query's step-by-step transformations, you'll adapt quickly. The visual canvas makes complex workflows easier to understand than scrolling through Applied Steps.
