---
sidebar_position: 1
---

# Expression Basics

Sigilweaver uses [Polars expressions](https://docs.pola.rs/user-guide/expressions/) for filtering data and creating calculated columns. This page covers the fundamentals.

## Column References

Reference a column by name using `pl.col()`:

```python
pl.col("column_name")
pl.col("age")
pl.col("Total Sales")
```

Column names with spaces or special characters work the same way - just wrap them in quotes.

## Literals

Use `pl.lit()` to wrap constant values when they need to become column expressions:

```python
pl.lit("active")       # String literal
pl.lit(42)             # Integer literal
pl.lit(3.14)           # Float literal
pl.lit(True)           # Boolean literal
```

### When You Need `pl.lit()`

You **must** use `pl.lit()` when assigning or returning a constant value:

```python
# In Formula tool - assign a constant to a new column
pl.lit("Complete")

# In conditional returns (.then and .otherwise)
pl.when(pl.col("status") == "active").then(pl.lit("Yes")).otherwise(pl.lit("No"))

# Fill null values with a constant
pl.col("value").fill_null(pl.lit(0))
```

### When You Don't Need `pl.lit()`

You **don't need** `pl.lit()` for comparisons - bare values work fine:

```python
# Comparing to constants - no pl.lit() needed
pl.col("status") == "active"        # Works
pl.col("age") > 18                   # Works
pl.col("price") < 100.0              # Works

# These also work but are unnecessarily verbose:
pl.col("status") == pl.lit("active") # Unnecessary
pl.col("age") > pl.lit(18)           # Unnecessary
```

:::tip Rule of Thumb
**Comparisons**: Use bare values (`"active"`, `18`, `100.0`)  
**Assignments/Returns**: Use `pl.lit()` to wrap the value
:::

## Comparison Operators

| Operation | Operator | Example |
|-----------|----------|---------|
| Equals | `==` | `pl.col("status") == "active"` |
| Not equals | `!=` | `pl.col("status") != "deleted"` |
| Greater than | `>` | `pl.col("age") > 18` |
| Greater or equal | `>=` | `pl.col("score") >= 70` |
| Less than | `<` | `pl.col("price") < 100` |
| Less or equal | `<=` | `pl.col("quantity") <= 10` |

## Logical Operators

| Operation | Operator | Example |
|-----------|----------|---------|
| And | `&` | `(expr1) & (expr2)` |
| Or | `\|` | `(expr1) \| (expr2)` |
| Not / Invert | `~` | `~pl.col("is_deleted")` |

### Invert (`~`)

The `~` operator inverts boolean values:

```python
~pl.col("is_active")           # True becomes False, False becomes True
~(pl.col("status") == "done")  # Rows where status is NOT "done"
```

:::caution
The `~` operator only works on boolean columns or expressions that return boolean values.
:::

## Arithmetic Operators

| Operation | Operator | Example |
|-----------|----------|---------|
| Addition | `+` | `pl.col("price") + pl.col("tax")` |
| Subtraction | `-` | `pl.col("revenue") - pl.col("cost")` |
| Multiplication | `*` | `pl.col("quantity") * pl.col("unit_price")` |
| Division | `/` | `pl.col("total") / pl.col("count")` |
| Floor division | `//` | `pl.col("seconds") // 60` |
| Modulo | `%` | `pl.col("value") % 2` |

## Chaining Operations

Polars expressions are chainable - you can call multiple methods in sequence:

```python
pl.col("name").str.to_lowercase().str.strip_chars()
pl.col("date").dt.year()
pl.col("price").round(2).cast(pl.Float64)
```

## Using the Expression Editor

Sigilweaver's expression editor includes autocomplete that makes working with Polars expressions fast and approachable - **you don't need to memorize function names or column names**.

### Tab Completion for Column Names

When you type `pl.col("` and press Tab, you'll see a list of all available columns from your input data:

```python
pl.col("  # Press Tab here to see your columns
```

**Example workflow**:
1. Type `pl.col("win` 
2. Press Tab → auto-completes to `pl.col("Winning Numbers")`
3. The editor handles spaces and special characters automatically

You can also press Tab at any point while typing a column name to see matching suggestions.

### Tab Completion for Methods

After typing a column reference or any expression, press `.` followed by Tab to see available methods. **The suggestions are context-aware** - they show methods relevant to your column's data type.

**For string columns**:
```python
pl.col("email").  # Press Tab to see .str.contains(), .str.to_lowercase(), etc.
```

**For date columns**:
```python
pl.col("created_at").  # Press Tab to see .dt.year(), .dt.month(), etc.
```

**For numeric columns**:
```python
pl.col("price").  # Press Tab to see .round(), .abs(), .clip(), etc.
```

### Type-Ahead Filtering

You don't need to scroll through the full list - just start typing:

```python
pl.col("name").str.con  # Press Tab → completes to .str.contains()
pl.col("date").dt.ye     # Press Tab → completes to .dt.year()
```

### Complete Example: Building an Expression Step-by-Step

Let's create an expression to check if a passenger's name contains "Mrs" (to identify married women in the Titanic dataset):

1. **Start with column**: Type `pl.col("Na` → Tab → `pl.col("Name")`
2. **Add method**: Type `.str.con` → Tab → `.str.contains("")`
3. **Fill in argument**: Move cursor inside quotes, type `Mrs`

**Final expression**: `pl.col("Name").str.contains("Mrs")`

The entire process uses Tab completion - **no memorization required**.

### Tips for Using Autocomplete

- Press **Tab** at any time to see completions
- Press **Ctrl+Space** (or **Cmd+Space** on Mac) to manually trigger autocomplete
- Use arrow keys to navigate suggestions, Enter to accept
- Type a few characters to filter the suggestion list

### Don't Be Intimidated by "Raw Polars"

While the editor shows raw Polars expressions, the autocomplete system guides you through the syntax. You're not writing code from scratch - you're **selecting from available options** and filling in the details.

**Common workflow pattern**:
1. `pl.col("` + Tab = pick your column
2. `.` + Tab = see what you can do with it
3. Type a few letters + Tab = narrow down to the operation you want
4. Fill in any arguments (strings, numbers, etc.)

## External Reference

For the complete Polars expression API, see the [Polars User Guide](https://docs.pola.rs/user-guide/expressions/).
