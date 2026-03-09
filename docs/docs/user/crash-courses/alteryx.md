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
Drag **Filter** tool → Use the **visual condition builder** to pick columns, operators, and values → T/F outputs

The Filter tool's **Basic mode** goes beyond Alteryx's traditional expression builder. While Alteryx has historically limited you to a single condition, Sigilweaver lets you add multiple conditions with AND/OR logic and even nested condition groups (up to 3 levels deep) - all visually. For advanced users, **Custom mode** lets you write Polars expressions directly.

### Creating Calculated Columns

**Alteryx:**  
Drag Formula tool → Name new column → Build expression

**Sigilweaver:**  
Drag **Formula** tool → Pick a source column → Choose an operation from 50+ built-in options → Name the output column

Unlike Alteryx, where formulas have traditionally required hand-written expressions, Sigilweaver's Formula tool has a **Basic mode** with a visual operation builder covering Math, Text, Date/Time, Null Handling, and Conditional logic. Multiple operations can be added to a single Formula node, and later operations can reference columns created by earlier ones. **Custom mode** is available for expressions that go beyond the built-in operations.

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

Sigilweaver's **Basic mode** uses visual builders - you won't see any code. But when you need Custom mode, expressions use **Polars syntax**:

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

The [Expressions Guide](../expressions/basics) covers everything you need for Custom mode.

### 2. Lazy Evaluation

Alteryx has traditionally executed tools eagerly as you run the workflow. Sigilweaver uses **lazy evaluation**:
- Workflow is optimized before execution
- Operations are only executed when needed (preview or save)
- Enables processing datasets larger than memory

### 3. Visual Builders

Alteryx has visual configuration for some operations, but it has historically been limited. The Filter tool's expression builder has traditionally supported only a single condition - anything more complex requires hand-written expressions. The Formula tool has no visual builder.

Sigilweaver goes further. The Filter tool's **Basic mode** supports multiple conditions with AND/OR logic, nested groups, type-aware operators, and inline comments - all visually. The Formula tool's **Basic mode** offers **50+ built-in operations** through dropdowns and parameter inputs - no expression syntax required. **Custom mode** lets power users write Polars expressions directly for advanced logic.

### 4. YXDB File Support

Sigilweaver can natively read Alteryx `.yxdb` files using [SigilYX](https://github.com/Sigilweaver/sigilyx), our open-source Rust-based reader. Just select YXDB as your input format - all 17 YXDB field types are supported. This makes migrating your existing Alteryx data seamless.

### 5. Cross-Platform Desktop App

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
   - In Basic mode: pick `order_status`, choose `equals`, type `completed`
   - Use the **T** output for next step

3. **Calculate revenue:**
   - Drag **Formula** tool, wire from Filter's T output
   - In Basic mode: pick `price` as source, choose **Multiply** operation, select `quantity` as the second column
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

Alteryx is fast. Sigilweaver is also fast. It's built on **Polars**, a Rust-based dataframe library designed for performance. For most workloads, performance is comparable. The lazy evaluation model can actually be faster for complex workflows since Sigilweaver optimizes the entire pipeline before executing.

## Next Steps

- **[Interface Guide](../interface/canvas)** - Canvas navigation, shortcuts, and tips
- **[Expressions Basics](../expressions/basics)** - Learn Polars expression syntax (for Custom mode)
- **[Tools Reference](../tools/)** - Detailed docs for every tool

If you're comfortable with Alteryx workflows, you'll adapt to Sigilweaver quickly. The visual builders in Filter and Formula actually go beyond what Alteryx offers - and Custom mode is there whenever you need even more power.
