---
sidebar_position: 3
---

# Coming from Alteryx

If you're an Alteryx user, you're already familiar with visual workflows and the power of drag-and-drop data transformation. Sigilweaver follows similar principles with some key differences.

## Terminology Mapping

| Alteryx | Sigilweaver | Notes |
|---------|-------------|-------|
| Workflow (yxmd) | Workflow (swwf) | Both are saved files |
| Tool | Tool | Dragged from palette onto canvas |
| Connection | Wire | Links between tools |
| Browse Tool | Data Preview | Click any tool to inspect output |
| Input Data Tool | Input tool | Load CSV, Parquet, Excel |
| Output Data Tool | Output tool | Save to various formats |
| Select Tool | Select tool | Choose, rename, reorder, cast columns |
| Filter Tool | Filter tool | Split data on condition |
| Summarize Tool | Summarize tool | Group and aggregate |
| Join Tool | Join tool | Combine datasets |
| Union Tool | Union tool | Stack datasets vertically |
| Formula Tool | Formula tool | Create calculated columns |
| Sort Tool | Sort tool | Order rows by columns |

## Common Tasks

### Loading Data

**Alteryx:**  
Drag Input Data tool → Browse for file → Auto-preview

**Sigilweaver:**  
Drag **Input** tool → Pick your file → Preview after execution

### Filtering Rows

**Alteryx:**  
Drag Filter tool → Build expression with GUI → True/False outputs

**Sigilweaver:**  
Drag **Filter** tool → Write Polars expression like `pl.col("amount") > 100` → T/F outputs

**Key difference:** Sigilweaver uses code-based expressions instead of Alteryx's expression builder GUI. More concise, but requires learning the [Polars syntax](../expressions/basics).

### Creating Calculated Columns

**Alteryx:**  
Drag Formula tool → Name new column → Build expression

**Sigilweaver:**  
Drag **Formula** tool → Write expression like `pl.col("price") * 1.1` → Name the output column

Both tools create new columns or replace existing ones.

### Selecting Columns

**Alteryx:**  
Drag Select tool → Check/uncheck columns → Rename if needed

**Sigilweaver:**  
Drag **Select** tool → Configure columns to keep/remove → Rename, reorder, or cast types

### Aggregating Data

**Alteryx:**  
Drag Summarize tool → Group By columns → Add aggregations (Sum, Count, etc.)

**Sigilweaver:**  
Drag **Summarize** tool → Set columns to "Group By" → Choose aggregation type for each metric column

### Joining Tables

**Alteryx:**  
Drag Join tool → Connect L and R inputs → Configure join keys → J/L/R outputs

**Sigilweaver:**  
Drag **Join** tool → Wire left (L) and right (R) inputs → Configure keys → Three outputs: J (matched), L (unmatched left), R (unmatched right)

**Same concept!** Sigilweaver's join outputs work exactly like Alteryx's J/L/R anchors.

## Key Differences

### 1. Expression Syntax

Alteryx uses its own expression language with functions like `[Field1] + [Field2]` and `IF-THEN-ELSE`.

Sigilweaver uses **Polars expressions**:

```python
# Column reference
pl.col("field_name")

# Calculation
pl.col("price") * pl.col("quantity")

# Conditional (like IF-THEN-ELSE)
pl.when(pl.col("status") == "active")
  .then(pl.col("price"))
  .otherwise(0)
```

The [Expressions Guide](../expressions/basics) covers everything you need.

### 2. Lazy Evaluation

Alteryx executes tools as you run the workflow. Sigilweaver uses **lazy evaluation**:
- Workflow is optimized before execution
- Operations are only executed when needed (preview or save)
- Enables processing datasets larger than memory

### 3. No Visual GUI Builders

Alteryx has visual configuration for many operations (Select Records, Expression Builder, etc.). Sigilweaver relies more on text-based configuration:
- Faster for experienced users
- More concise and reproducible
- Requires learning expression syntax upfront

### 4. Cross-Platform Desktop App

Alteryx is Windows-only. Sigilweaver runs natively on **Linux, macOS, and Windows**.

## Your First Workflow

Let's build a common Alteryx pattern: load transaction data, filter for completed orders, calculate revenue, and summarize by product.

**Steps:**

1. **Load transactions:**
   - Drag **Input** tool to canvas
   - Pick your CSV file
   - Click to preview data

2. **Filter for completed orders:**
   - Drag **Filter** tool, wire from Input
   - Expression: `pl.col("order_status") == "completed"`
   - Use the **T** output for next step

3. **Calculate revenue:**
   - Drag **Formula** tool, wire from Filter's T output
   - Expression: `pl.col("price") * pl.col("quantity")`
   - Output column name: `revenue`

4. **Summarize by product:**
   - Drag **Summarize** tool, wire from Formula
   - Set `product_name` to **Group By**
   - Set `revenue` to **Sum**
   - Set `order_id` to **Count** (for order count)

5. **Save results:**
   - Drag **Output** tool, wire from Summarize
   - Configure output path (CSV, Parquet, or Excel)
   - Execute workflow

## Performance Note

Alteryx is fast. Sigilweaver is also fast—it's built on **Polars**, a Rust-based dataframe library designed for performance. For most workloads, performance is comparable. The lazy evaluation model can actually be faster for complex workflows since Sigilweaver optimizes the entire pipeline before executing.

## Next Steps

- **[Interface Guide](../interface/canvas)** - Canvas navigation, shortcuts, and tips
- **[Expressions Basics](../expressions/basics)** - Learn Polars expression syntax
- **[Tools Reference](../tools/)** - Detailed docs for every tool

If you're comfortable with Alteryx workflows, you'll adapt to Sigilweaver quickly. The main learning curve is the expression language, but it becomes second nature with practice.
