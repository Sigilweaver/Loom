---
sidebar_position: 2
---

# Coming from Tableau Prep

If you're familiar with Tableau Prep Builder, you already understand visual data pipelines. Sigilweaver uses similar concepts with a few differences.

## Terminology Mapping

| Tableau Prep | Sigilweaver | Notes |
|--------------|-------------|-------|
| Flow | Workflow | Both are saved files containing your pipeline |
| Step | Tool | Dragged from palette onto canvas |
| Connection | Wire | Visual links between steps/tools |
| Input | Input tool | Load CSV, Parquet, Excel files |
| Output | Output tool | Save to CSV, Parquet, Excel, JSON |
| Profile Pane | Data Preview | Click any tool to see its output |
| Changes Pane | Configuration Panel | Left-side panel for tool settings |
| Clean Step | Select tool | Choose, rename, reorder, cast columns |
| Filter Rows | Filter tool | Split data on true/false condition |
| Aggregate | Summarize tool | Group and calculate aggregations |
| Join | Join tool | Combine datasets on key columns |
| Union | Union tool | Stack datasets vertically |
| Pivot | Pivot tool | Reshape long to wide |
| Pivot (reverse) | Unpivot tool | Reshape wide to long |

## Common Tasks

### Loading Data

**Tableau Prep:**  
Connect → Select file → Preview appears

**Sigilweaver:**  
Drag **Input** tool → Pick your file → Preview shows after execution

### Filtering Rows

**Tableau Prep:**  
Add Clean Step → Filter tab → Select field and condition

**Sigilweaver:**  
Drag **Filter** tool → Write expression like `pl.col("age") > 18` → True/False outputs split the data

**Key difference:** Sigilweaver uses Polars expressions instead of a GUI builder. This is more powerful but requires learning the syntax (see [Expressions Guide](../expressions/basics)).

### Selecting/Renaming Columns

**Tableau Prep:**  
Clean Step → Remove/rename columns in the profile pane

**Sigilweaver:**  
Drag **Select** tool → Configure which columns to keep, rename, reorder, or cast

### Aggregating Data

**Tableau Prep:**  
Add Aggregate step → Choose group fields → Choose aggregations

**Sigilweaver:**  
Drag **Summarize** tool → Select "Group By" for grouping columns → Select aggregation type (Sum, Mean, Count, etc.) for each column

### Joining Tables

**Tableau Prep:**  
Add Join step → Drag in second input → Configure join keys and type

**Sigilweaver:**  
Drag **Join** tool → Wire left and right inputs → Configure keys and suffix → Three outputs: matched (J), unmatched left (L), unmatched right (R)

## Key Differences

### 1. Expression Language

Tableau Prep uses visual builders for most operations. Sigilweaver uses **Polars expressions** for filtering and formulas:

```python
# Filter example
pl.col("sales") > 1000

# Formula example  
pl.col("price") * pl.col("quantity")
```

Don't worry - the [Expressions Guide](../expressions/basics) covers everything you need.

### 2. Lazy Evaluation

Tableau Prep executes each step as you build. Sigilweaver uses **lazy evaluation**:
- The workflow is optimized before execution
- Data isn't processed until you preview or execute
- This allows working with datasets larger than memory

### 3. Multiple Outputs

In Sigilweaver, tools can have multiple outputs. For example:
- **Filter** has True and False outputs
- **Join** has matched, unmatched-left, and unmatched-right outputs

This gives you more flexibility to handle edge cases.

## Your First Workflow

Let's recreate a simple Tableau Prep flow: load sales data, filter for active customers, and calculate total sales by region.

**Steps:**

1. **Load data:**
   - Drag **Input** tool to canvas
   - Pick your CSV file
   - Click the tool to preview data

2. **Filter for active customers:**
   - Drag **Filter** tool, wire from Input
   - Expression: `pl.col("status") == "active"`
   - Wire from the **T** (true) output for next step

3. **Calculate total by region:**
   - Drag **Summarize** tool, wire from Filter's T output
   - Set `region` to **Group By**
   - Set `sales` to **Sum**
   - Preview shows totals by region

4. **Save results:**
   - Drag **Output** tool, wire from Summarize
   - Configure output path and format
   - Execute workflow to save file

## Next Steps

- **[Interface Guide](../interface/canvas)** - Learn canvas navigation and shortcuts
- **[Expressions Basics](../expressions/basics)** - Master the expression syntax
- **[Tools Reference](../tools/)** - Explore all available tools

The visual paradigm is similar to Tableau Prep, so you'll feel at home quickly. The main learning curve is expressions, but they unlock more power than click-based builders.
