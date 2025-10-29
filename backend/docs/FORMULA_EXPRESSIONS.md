# Formula Tool: Expression Guide

The Formula tool supports two expression syntaxes to balance ease of use with power.

## Simple Mode (Recommended for Most Cases)

Use `{column}` syntax to reference columns. The backend automatically converts to Polars code.

### Basic Arithmetic

```javascript
// Config
{
  "column_name": "total",
  "expression": "{price} * {quantity}",
  "mode": "simple"
}

// What user sees: {price} * {quantity}
// Backend converts to: pl.col('price') * pl.col('quantity')
```

### Comparisons

```javascript
{
  "column_name": "is_adult",
  "expression": "{age} >= 18",
  "mode": "simple"
}

{
  "column_name": "is_expensive",
  "expression": "{price} > 100",
  "mode": "simple"
}

{
  "column_name": "price_higher_than_cost",
  "expression": "{price} > {cost}",
  "mode": "simple"
}
```

### Complex Calculations

```javascript
// Calculate discount
{
  "column_name": "final_price",
  "expression": "{price} * (1 - {discount_pct} / 100)",
  "mode": "simple"
}

// Combine multiple columns
{
  "column_name": "bmi",
  "expression": "{weight_kg} / ({height_m} ** 2)",
  "mode": "simple"
}

// Percentage calculation
{
  "column_name": "profit_margin",
  "expression": "({revenue} - {cost}) / {revenue} * 100",
  "mode": "simple"
}
```

### When Simple Mode Works

Column references: `{column}`  
Arithmetic: `+`, `-`, `*`, `/`, `**`, `%`  
Comparison: `>`, `<`, `>=`, `<=`, `==`, `!=`  
Logical: `&` (and), `|` (or), `~` (not)  
Parentheses for grouping

## Advanced Mode (For Complex Logic)

Use raw Polars expressions for advanced features like conditionals, string operations, and type conversions.

### Conditional Logic

```javascript
// Age categories
{
  "column_name": "age_group",
  "expression": "pl.when(pl.col('age') < 30).then(pl.lit('Young')).when(pl.col('age') < 50).then(pl.lit('Middle')).otherwise(pl.lit('Senior'))",
  "mode": "advanced"
}

// Tiered pricing
{
  "column_name": "price_tier",
  "expression": "pl.when(pl.col('quantity') > 100).then(pl.col('price') * 0.8).when(pl.col('quantity') > 50).then(pl.col('price') * 0.9).otherwise(pl.col('price'))",
  "mode": "advanced"
}

// Status flags
{
  "column_name": "status",
  "expression": "pl.when(pl.col('amount') > 1000).then(pl.lit('High')).otherwise(pl.lit('Normal'))",
  "mode": "advanced"
}
```

### String Operations

```javascript
// Uppercase
{
  "column_name": "name_upper",
  "expression": "pl.col('name').str.to_uppercase()",
  "mode": "advanced"
}

// Extract substring
{
  "column_name": "area_code",
  "expression": "pl.col('phone').str.slice(0, 3)",
  "mode": "advanced"
}

// String concatenation
{
  "column_name": "full_name",
  "expression": "pl.col('first_name') + pl.lit(' ') + pl.col('last_name')",
  "mode": "advanced"
}

// String length
{
  "column_name": "name_length",
  "expression": "pl.col('name').str.len_chars()",
  "mode": "advanced"
}
```

### Type Conversions

```javascript
// Convert to integer
{
  "column_name": "age_int",
  "expression": "pl.col('age_str').cast(pl.Int64)",
  "mode": "advanced"
}

// Convert to float
{
  "column_name": "price_float",
  "expression": "pl.col('price_str').cast(pl.Float64)",
  "mode": "advanced"
}

// Convert to date
{
  "column_name": "birth_date",
  "expression": "pl.col('birth_str').str.strptime(pl.Date, '%Y-%m-%d')",
  "mode": "advanced"
}
```

### Mathematical Functions

```javascript
// Absolute value
{
  "column_name": "abs_value",
  "expression": "pl.col('value').abs()",
  "mode": "advanced"
}

// Rounding
{
  "column_name": "price_rounded",
  "expression": "pl.col('price').round(2)",
  "mode": "advanced"
}

// Square root
{
  "column_name": "sqrt_value",
  "expression": "pl.col('value').sqrt()",
  "mode": "advanced"
}
```

### Null Handling

```javascript
// Fill nulls with default
{
  "column_name": "quantity_filled",
  "expression": "pl.col('quantity').fill_null(0)",
  "mode": "advanced"
}

// Replace nulls with expression
{
  "column_name": "price_or_default",
  "expression": "pl.col('price').fill_null(pl.col('default_price'))",
  "mode": "advanced"
}

// Check if null
{
  "column_name": "has_email",
  "expression": "pl.col('email').is_not_null()",
  "mode": "advanced"
}
```

## Frontend Integration

### Simple Mode UI

```typescript
// Column picker button inserts {column}
<button onClick={() => insertText(`{${selectedColumn}}`)}>
  Insert Column
</button>

// Operator buttons
<div className="operators">
  <button onClick={() => insertText(' + ')}>+</button>
  <button onClick={() => insertText(' - ')}>-</button>
  <button onClick={() => insertText(' * ')}>×</button>
  <button onClick={() => insertText(' / ')}>÷</button>
  <button onClick={() => insertText(' > ')}>></button>
  <button onClick={() => insertText(' < ')}><</button>
  <button onClick={() => insertText(' == ')}>==</button>
</div>

// Expression input
<input 
  value={expression}
  onChange={e => setExpression(e.target.value)}
  placeholder="Example: {price} * {quantity}"
/>
```

### Advanced Mode UI

```typescript
// Function dropdown
<select onChange={e => insertFunction(e.target.value)}>
  <option value="">Insert function...</option>
  <option value="pl.when(expr).then(val).otherwise(val)">Conditional (when/then)</option>
  <option value="pl.col('col').str.to_uppercase()">Uppercase</option>
  <option value="pl.col('col').str.to_lowercase()">Lowercase</option>
  <option value="pl.col('col').cast(pl.Float64)">Convert to Float</option>
  <option value="pl.col('col').fill_null(0)">Fill Nulls</option>
</select>

// Code editor with syntax highlighting
<CodeEditor
  value={expression}
  onChange={setExpression}
  language="python"
  theme="monokai"
/>
```

### Mode Switcher

```typescript
<RadioGroup value={mode} onChange={setMode}>
  <Radio value="simple">
    Simple - Use {'{column}'} for columns
  </Radio>
  <Radio value="advanced">
    Advanced - Raw Polars expressions
  </Radio>
</RadioGroup>

{mode === 'simple' && <SimpleExpressionBuilder />}
{mode === 'advanced' && <AdvancedCodeEditor />}
```

## Expression Validation

Both modes validate expressions before execution:

```javascript
// Backend validates during execute()
try {
  const result = await executeToolPreview("formula1", workflow);
  // Show preview
} catch (error) {
  // Show error: "Invalid expression: ColumnNotFoundError: column 'xyz' not found"
}
```

## Examples by Use Case

### Financial Calculations

```javascript
// Simple
{expression: "{revenue} - {costs}", mode: "simple"}
{expression: "({revenue} - {costs}) / {revenue} * 100", mode: "simple"}

// Advanced
{expression: "pl.col('amount').round(2)", mode: "advanced"}
{expression: "pl.when(pl.col('profit') < 0).then(pl.lit('Loss')).otherwise(pl.lit('Profit'))", mode: "advanced"}
```

### Text Processing

```javascript
// Advanced only (strings require .str methods)
{expression: "pl.col('email').str.to_lowercase()", mode: "advanced"}
{expression: "pl.col('name').str.replace('_', ' ')", mode: "advanced"}
{expression: "pl.col('description').str.slice(0, 100) + pl.lit('...')", mode: "advanced"}
```

### Data Cleaning

```javascript
// Simple
{expression: "{value} * 1.0", mode: "simple"}  // Coerce to float

// Advanced
{expression: "pl.col('price').fill_null(0)", mode: "advanced"}
{expression: "pl.col('date_str').str.strptime(pl.Date, '%Y-%m-%d')", mode: "advanced"}
{expression: "pl.col('name').str.strip_chars()", mode: "advanced"}
```

## Best Practices

1. **Start with Simple Mode** - Easier to learn and covers 80% of use cases
2. **Use Advanced for Strings** - String operations require `.str` methods
3. **Use Advanced for Conditionals** - `pl.when()` is clearer than nested expressions
4. **Preview Early** - Test expressions with sample data before running on full dataset
5. **Add Comments** - Use the description field to document complex formulas
6. **Validate Column Names** - Use schema endpoint to ensure columns exist

## Security Note

Both modes use `eval()` with restricted namespace (only `pl` module available). This prevents arbitrary code execution but users should still only run expressions they trust.

For production, consider:
- Expression parsing library (no eval)
- Sandboxed execution environment
- Expression complexity limits
- Timeout for long-running expressions
