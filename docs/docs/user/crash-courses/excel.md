---
sidebar_position: 7
---

# Coming from Excel

If you're an Excel power user ready to move beyond spreadsheet limits, Sigilweaver brings the repeatability and scalability you need while keeping data transformation visual and approachable.

## Why Move from Excel to Sigilweaver?

### What Excel Does Well
- Familiar interface for most business users
- Quick ad-hoc calculations and pivots
- Easy sharing with non-technical colleagues
- Built-in charting and formatting

### Where Excel Struggles
- **Row limits:** 1,048,576 rows maximum - real datasets often exceed this
- **Performance:** Slows down with formulas across hundreds of thousands of rows
- **Repeatability:** Manual steps are hard to reproduce - copy/paste errors are common
- **Version control:** "final_v2_REVISED_latest.xlsx" is not sustainable
- **Merging data:** VLOOKUPs are fragile and break when column order changes

### What Sigilweaver Adds
- **No row limits** - Process millions of rows efficiently
- **Fast performance** - Built on Polars (Rust), optimized for large datasets
- **Repeatable workflows** - Save your pipeline, run it on new data anytime
- **Version control friendly** - Workflows are text files, works with Git
- **Robust joins** - Joins don't break when data changes

## Excel Concepts → Sigilweaver Equivalents

| Excel Concept | Sigilweaver | Notes |
|---------------|-------------|-------|
| Workbook | Workflow file | Saved pipeline (.swwf) |
| Sheet tab | Input tool | Load data from CSV, Parquet, Excel |
| Formula in column | Formula tool | Create calculated columns |
| Filter (Data tab) | Filter tool | Keep/remove rows by condition |
| Hide columns | Select tool | Choose which columns to keep |
| Sort (Data tab) | Sort tool | Order rows by column values |
| Pivot Table | Summarize / Pivot tool | Group data, aggregate, or reshape |
| VLOOKUP/XLOOKUP | Join tool | Combine two tables by key |
| Copy/Paste to stack data | Union tool | Stack datasets vertically |
| Save As | Output tool | Save results to file |

## Common Excel Tasks in Sigilweaver

### Loading Data

**Excel:**  
Open file → Data loads into sheet

**Sigilweaver:**  
Drag **Input** tool → Pick your file → Preview data

**Pro tip:** Sigilweaver can load CSV, Parquet, and Excel files. For large datasets, use CSV or Parquet for better performance.

### Filtering Rows

**Excel:**  
Select header row → Data → Filter → Click dropdown → Choose values

**Sigilweaver:**  
Drag **Filter** tool → Use the visual condition builder to pick columns, operators, and values

**Key difference:** Excel uses clickable filters. Sigilweaver's Filter tool has a **visual builder** (Basic mode) that works similarly - pick a column, choose an operator, enter a value. For advanced logic, **Custom mode** lets you write Polars expressions directly.

### Creating Calculated Columns

**Excel:**  
Click cell in new column → Type formula like `=A2*B2` → Drag down

**Sigilweaver:**  
Drag **Formula** tool → Pick a source column → Choose from 50+ built-in operations (Multiply, Round, Uppercase, etc.) → Name the output column (e.g., `revenue`)

For advanced calculations, switch to **Custom mode** and write expressions like `pl.col("price") * pl.col("quantity")`.

**Advantage:** No dragging formulas down thousands of rows - the expression applies to the entire column automatically.

### Removing/Selecting Columns

**Excel:**  
Right-click column → Hide OR Select columns → Copy → Paste to new sheet

**Sigilweaver:**  
Drag **Select** tool → Check columns to keep → Configure rename or reorder if needed

### Sorting Data

**Excel:**  
Select data → Data → Sort → Choose column and order

**Sigilweaver:**  
Drag **Sort** tool → Configure columns and ascending/descending order

### Pivot Tables (Grouping and Aggregating)

**Excel:**  
Insert → Pivot Table → Drag fields to Rows/Values → Choose aggregation

**Sigilweaver:**  
Drag **Summarize** tool → Set columns to "Group By" → Choose aggregation (Sum, Mean, Count, etc.) for each metric

**Advantage:** Sigilweaver aggregations are part of the repeatable pipeline - no need to rebuild the pivot table on new data.

### VLOOKUP / XLOOKUP (Joining Tables)

**Excel:**  
`=VLOOKUP(A2, Sheet2!A:C, 3, FALSE)` or `=XLOOKUP(A2, Sheet2!A:A, Sheet2!C:C)`

**Sigilweaver:**  
Drag **Join** tool → Wire left (L) and right (R) inputs → Configure join keys → Get three outputs: matched (J), unmatched left (L), unmatched right (R)

**Advantage:** 
- No formula errors if column order changes
- See unmatched rows explicitly (no #N/A to hunt down)
- Faster on large datasets

### Stacking Data (Copy/Paste from Multiple Sheets)

**Excel:**  
Copy data from Sheet1 → Paste below data in Sheet2 → Repeat for each sheet

**Sigilweaver:**  
Drag **Union** tool → Wire multiple Input tools to it → Data stacks automatically

## Your First Workflow

Let's replicate a common Excel task: load sales data, filter for completed orders, calculate revenue, and create a summary by region.

**Steps:**

1. **Load sales data:**
   - Drag **Input** tool to canvas
   - Pick your CSV/Excel file
   - Click tool to preview data

2. **Filter for completed orders:**
   - Drag **Filter** tool, wire from Input
   - In Basic mode: pick `order_status`, choose `equals`, type `completed`
   - Use the **T** (true) output for next step

3. **Calculate revenue:**
   - Drag **Formula** tool, wire from Filter's T output
   - In Basic mode: pick `price` as source, choose **Multiply** operation, select `quantity` as the second column
   - Output column name: `revenue`

4. **Summarize by region:**
   - Drag **Summarize** tool, wire from Formula
   - Set `region` to **Group By**
   - Set `revenue` to **Sum**
   - Set `order_id` to **Count** (for order count)

5. **Save results:**
   - Drag **Output** tool, wire from Summarize
   - Choose format (Excel, CSV, or Parquet)
   - Pick output location and execute

**Now you have a repeatable pipeline.** Next month, load new data into the same workflow and execute - no manual steps.

## Key Mental Shifts from Excel

### 1. Formulas Apply to Entire Columns

In Excel, you write `=A2*B2` and drag down. In Sigilweaver, you pick the **Multiply** operation in the Formula tool's visual builder, and it applies to all rows automatically. In Custom mode, `pl.col("price") * pl.col("quantity")` does the same thing.

### 2. No Manual Steps

Excel workflows often involve clicking, filtering, copying, pasting. Sigilweaver workflows are **entirely repeatable** - load new data, execute, done.

### 3. Data Stays in Files

Excel loads data into the application. Sigilweaver processes data from files and saves results back to files - data never "lives" in the application.

### 4. Visual Builders Instead of Cell References

Excel formulas use cell references (`A2`, `B5`). Sigilweaver's **Basic mode** uses visual builders - pick a column, choose an operation, done. In **Custom mode**, you use column names:

```python
# Excel: =A2*B2
# Sigilweaver (Custom mode): 
pl.col("price") * pl.col("quantity")
```

The [Expressions Guide](../expressions/basics) covers Custom mode syntax for when you need it.

## When to Use Excel vs. Sigilweaver

**Use Excel when:**
- Dataset is under 100,000 rows
- You need quick ad-hoc analysis
- You need formatted reports with charts
- You're sharing with people who only know Excel

**Use Sigilweaver when:**
- Dataset is large (millions of rows)
- You repeat the same steps monthly/weekly
- You need complex joins or unions
- You want reproducible, version-controlled pipelines

**Use both:**
- Sigilweaver for data preparation → Save to Excel → Deliver formatted reports in Excel

## Next Steps

- **[Interface Guide](../interface/canvas)** - Learn the visual canvas and workflow building
- **[Expressions Basics](../expressions/basics)** - Learn Polars expressions for Custom mode (like Excel formulas, but for columns)
- **[Tools Reference](../tools/)** - Detailed docs for every tool

Excel is great for what it does, but when you hit its limits, Sigilweaver is the next step. The visual builders in Filter and Formula keep things approachable - most users never need to write expressions. And Custom mode is there when you need more power.
