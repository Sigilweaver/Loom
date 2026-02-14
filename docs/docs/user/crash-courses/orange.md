---
sidebar_position: 6
---

# Coming from Orange

If you're an Orange user, you're familiar with widget-based visual programming for data science. Sigilweaver shares the visual workflow approach but focuses on data transformation rather than machine learning.

## Terminology Mapping

| Orange | Sigilweaver | Notes |
|--------|-------------|-------|
| Workflow | Workflow | Saved pipeline file |
| Widget | Tool | Dragged from palette onto canvas |
| Channel | Wire | Connections between widgets/tools |
| File | Input tool | Load CSV, Parquet, Excel |
| Save Data | Output tool | Save transformed data |
| Select Columns | Select tool | Choose, rename, reorder columns |
| Select Rows | Filter tool | Filter rows by condition |
| Group | Summarize tool | Aggregate by groups |
| Merge Data | Join tool | Combine datasets |
| Concatenate | Union tool | Stack datasets vertically |
| Feature Constructor | Formula tool | Create calculated columns |

## Common Tasks

### Loading Data

**Orange:**  
Drag File widget → Browse for file → Data automatically loads

**Sigilweaver:**  
Drag **Input** tool → Pick your file → Preview after execution

### Filtering Rows

**Orange:**  
Drag Select Rows widget → Choose conditions visually

**Sigilweaver:**  
Drag **Filter** tool → Use the visual condition builder to pick columns, operators, and values → True/False outputs

Sigilweaver's Filter tool has a **visual builder** (Basic mode) similar to Orange's approach - pick a column, choose an operator, enter a value. **Custom mode** is available for writing Polars expressions directly.

### Selecting Features (Columns)

**Orange:**  
Drag Select Columns widget → Drag columns between Available/Features/Meta

**Sigilweaver:**  
Drag **Select** tool → Check columns to keep → Configure rename, reorder, or type casting

### Creating New Features

**Orange:**  
Drag Feature Constructor widget → Define new feature with expression

**Sigilweaver:**  
Drag **Formula** tool → Pick a source column → Choose from 50+ built-in operations → Name output column

For advanced calculations, switch to **Custom mode** and write expressions like `pl.col("height") / pl.col("weight")`.

### Grouping and Aggregating

**Orange:**  
Drag Aggregate widget (if available) or use Group widget

**Sigilweaver:**  
Drag **Summarize** tool → Set columns to "Group By" → Choose aggregation (Sum, Mean, Count, etc.) for metrics

### Merging Datasets

**Orange:**  
Drag Merge Data widget → Connect two data sources → Configure merge type

**Sigilweaver:**  
Drag **Join** tool → Wire left (L) and right (R) inputs → Configure join keys → Three outputs: matched (J), unmatched left (L), unmatched right (R)

## Key Differences

### 1. Scope: Data Prep vs. Machine Learning

**Orange** is a visual data mining and machine learning platform:
- Classification, regression, clustering widgets
- Model evaluation and visualization
- Interactive data exploration
- Educational focus for teaching ML concepts

**Sigilweaver** focuses on **data transformation and ETL**:
- Loading, cleaning, filtering, joining data
- Preparing datasets for analysis
- No ML models (yet)

Think of Sigilweaver as handling the **data wrangling phase** before you move to Orange for machine learning.

### 2. Expression Language

Orange uses visual builders and simple Python-like expressions.

Sigilweaver also has **visual builders** (Basic mode) for the Filter and Formula tools - most operations can be done entirely through dropdowns and parameter inputs. For advanced logic, **Custom mode** lets you write Polars expressions (Python-based):

```python
# Filter rows
pl.col("petal_length") > 5.0

# Create feature
pl.col("sepal_length") / pl.col("sepal_width")

# Conditional feature
pl.when(pl.col("species") == "setosa")
  .then(1)
  .otherwise(0)
```

The [Expressions Guide](../expressions/basics) covers the syntax in detail.

### 3. Target Audience

**Orange** is designed for:
- Students learning data science
- Researchers exploring data visually
- Users who want to try ML without coding

**Sigilweaver** is designed for:
- Data analysts who need repeatable pipelines
- Anyone preparing data for downstream analysis
- Users who want visual builders for common operations, with the option to write expressions for advanced logic

### 4. Performance and Scale

Orange loads entire datasets into memory. Sigilweaver uses **lazy evaluation**:
- Workflow is optimized before execution
- Processes data in streaming fashion when possible
- Handles datasets larger than available memory

## Your First Workflow

Let's build a simple Orange-style workflow: load data, filter, create a calculated column, and aggregate.

**Steps:**

1. **Load data:**
   - Drag **Input** tool to canvas
   - Pick your CSV file (e.g., iris.csv)
   - Click to preview

2. **Filter for specific species:**
   - Drag **Filter** tool, wire from Input
   - In Basic mode: pick `species`, choose `equals`, type `versicolor`
   - Use the **T** (true) output

3. **Calculate sepal ratio:**
   - Drag **Formula** tool, wire from Filter's T output
   - In Basic mode: pick `sepal_length` as source, choose **Divide** operation, select `sepal_width`
   - Output column name: `sepal_ratio`

4. **Aggregate statistics:**
   - Drag **Summarize** tool, wire from Formula
   - Set `species` to **Group By** (if you want per-species stats, or leave blank for global)
   - Set `sepal_ratio` to **Mean**
   - Set `petal_length` to **Mean**
   - Set `species` to **Count** (row count)

5. **Save results:**
   - Drag **Output** tool, wire from Summarize
   - Configure output format (CSV, Parquet, Excel)
   - Execute workflow

## What's Missing (Compared to Orange)?

Sigilweaver is focused on data transformation, so it doesn't have:
- Machine learning models (classification, regression, clustering)
- Interactive visualizations (scatter plots, box plots, etc.)
- Model evaluation widgets (confusion matrix, ROC curves)
- Educational add-ons for teaching

If you need ML and visualization, Orange is excellent. But for **data cleaning, joining, and preparation** at scale, Sigilweaver is faster and more efficient.

## Combining Orange and Sigilweaver

You can use both tools together:

1. **Sigilweaver:** Clean, filter, join, and prepare large datasets → Save to CSV/Parquet
2. **Orange:** Load the prepared data → Build ML models → Visualize results

This separation keeps each tool doing what it does best.

## Next Steps

- **[Interface Guide](../interface/canvas)** - Learn canvas navigation and workflow building
- **[Expressions Basics](../expressions/basics)** - Master Polars expression syntax
- **[Tools Reference](../tools/)** - Detailed documentation for every tool

If you like Orange's visual approach, you'll feel comfortable with Sigilweaver's canvas. The Filter and Formula tools now have visual builders that work similarly to Orange's approach, and Custom mode is there whenever you need more power.
