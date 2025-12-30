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
Drag **Filter** tool → Write expression like `pl.col("class") == "A"` → True/False outputs

**Key difference:** Orange uses GUI builders. Sigilweaver uses [Polars expressions](../expressions/basics) - more powerful but requires learning syntax.

### Selecting Features (Columns)

**Orange:**  
Drag Select Columns widget → Drag columns between Available/Features/Meta

**Sigilweaver:**  
Drag **Select** tool → Check columns to keep → Configure rename, reorder, or type casting

### Creating New Features

**Orange:**  
Drag Feature Constructor widget → Define new feature with expression

**Sigilweaver:**  
Drag **Formula** tool → Expression: `pl.col("height") / pl.col("weight")` → Name output column

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

Sigilweaver uses **Polars expressions** (Python-based):

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
- Users comfortable with expressions but who prefer visual workflow structure

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
   - Expression: `pl.col("species") == "versicolor"`
   - Use the **T** (true) output

3. **Calculate sepal ratio:**
   - Drag **Formula** tool, wire from Filter's T output
   - Expression: `pl.col("sepal_length") / pl.col("sepal_width")`
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

If you like Orange's visual approach, you'll feel comfortable with Sigilweaver's canvas. The main learning curve is expressions - they're more powerful than Orange's GUI builders once you get the hang of them.
