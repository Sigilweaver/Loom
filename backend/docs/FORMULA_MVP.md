# Formula Tool - MVP Guide

## Simple Approach: Polars Expressions + Helper Buttons

Users write Polars expressions directly, but the frontend provides helper buttons to build common patterns quickly.

## Backend API

```javascript
{
  "column_name": "new_column",
  "expression": "pl.col('age') > 30"
}
```

That's it! No modes, no special syntax. Just Polars expressions.

## Frontend UI (MVP)

### Basic Layout

```typescript
interface FormulaConfig {
  column_name: string;
  expression: string;
}

function FormulaToolConfig({ tool, workflow, onUpdate }: Props) {
  const [columnName, setColumnName] = useState('');
  const [expression, setExpression] = useState('');
  const [availableColumns, setAvailableColumns] = useState([]);

  // Fetch available columns from upstream tools
  useEffect(() => {
    getToolSchema(tool.id, workflow).then(schema => {
      const upstreamCols = getUpstreamColumns(schema);
      setAvailableColumns(upstreamCols);
    });
  }, [tool.id, workflow]);

  return (
    <div>
      <input 
        placeholder="New column name"
        value={columnName}
        onChange={e => setColumnName(e.target.value)}
      />
      
      {/* Helper buttons */}
      <HelperButtons 
        columns={availableColumns}
        onInsert={text => setExpression(expression + text)}
      />
      
      {/* Expression input */}
      <textarea
        placeholder="pl.col('column') > value"
        value={expression}
        onChange={e => setExpression(e.target.value)}
        rows={3}
      />
      
      <button onClick={() => onUpdate({ column_name: columnName, expression })}>
        Apply
      </button>
    </div>
  );
}
```

### Helper Buttons

```typescript
function HelperButtons({ columns, onInsert }: Props) {
  return (
    <div className="helper-buttons">
      {/* Column picker */}
      <select onChange={e => onInsert(`pl.col('${e.target.value}')`)}>
        <option value="">Insert column...</option>
        {columns.map(col => (
          <option key={col.name} value={col.name}>{col.name}</option>
        ))}
      </select>
      
      {/* Common operations */}
      <div className="operation-buttons">
        <button onClick={() => onInsert(' > ')}>></button>
        <button onClick={() => onInsert(' < ')}>&lt;</button>
        <button onClick={() => onInsert(' == ')}>==</button>
        <button onClick={() => onInsert(' >= ')}>>=</button>
        <button onClick={() => onInsert(' <= ')}><=</button>
        <button onClick={() => onInsert(' + ')}>+</button>
        <button onClick={() => onInsert(' - ')}>-</button>
        <button onClick={() => onInsert(' * ')}>×</button>
        <button onClick={() => onInsert(' / ')}>÷</button>
      </div>
      
      {/* Common patterns */}
      <select onChange={e => onInsert(e.target.value)}>
        <option value="">Insert pattern...</option>
        <option value="pl.when(CONDITION).then(pl.lit('VALUE')).otherwise(pl.lit('VALUE'))">
          If/Then/Else
        </option>
        <option value="pl.lit('value')">Text value</option>
        <option value=".str.to_uppercase()">Uppercase</option>
        <option value=".str.to_lowercase()">Lowercase</option>
        <option value=".cast(pl.Float64)">Convert to number</option>
      </select>
    </div>
  );
}
```

## Common Expression Examples

### Arithmetic
```javascript
"pl.col('price') * pl.col('quantity')"
"pl.col('a') + pl.col('b')"
"pl.col('amount') * 1.1"  // Increase by 10%
```

### Comparisons (Boolean)
```javascript
"pl.col('age') > 30"
"pl.col('price') >= 100"
"pl.col('status') == pl.lit('active')"
```

### Conditional (If/Then/Else)
```javascript
"pl.when(pl.col('age') > 65).then(pl.lit('Senior')).otherwise(pl.lit('Adult'))"

"pl.when(pl.col('score') >= 90).then(pl.lit('A')).when(pl.col('score') >= 80).then(pl.lit('B')).otherwise(pl.lit('C'))"
```

### String Operations
```javascript
"pl.col('name').str.to_uppercase()"
"pl.col('email').str.to_lowercase()"
"pl.col('text').str.slice(0, 10)"  // First 10 characters
```

### Type Conversions
```javascript
"pl.col('string_number').cast(pl.Float64)"
"pl.col('string_number').cast(pl.Int64)"
```

## Quick Reference Card (Show in UI)

```typescript
function QuickReference() {
  return (
    <details>
      <summary>Expression Help</summary>
      <div className="quick-ref">
        <h4>Reference a column:</h4>
        <code>pl.col('column_name')</code>
        
        <h4>Use a value:</h4>
        <code>pl.lit('text')</code> or just <code>123</code>
        
        <h4>Compare:</h4>
        <code>pl.col('age') > 30</code>
        
        <h4>If/Then:</h4>
        <code>pl.when(condition).then(value).otherwise(value)</code>
        
        <h4>Math:</h4>
        <code>+ - * / **</code>
        
        <h4>String methods:</h4>
        <code>.str.to_uppercase()</code><br/>
        <code>.str.to_lowercase()</code><br/>
        <code>.str.slice(0, 10)</code>
      </div>
    </details>
  );
}
```

## Error Handling

```typescript
async function testExpression() {
  try {
    const result = await previewTool(tool.id, workflow);
    setPreview(result);
    setError(null);
  } catch (err) {
    setError(err.message);
    // Show error: "Invalid expression: column 'xyz' not found"
  }
}
```

## MVP Implementation Checklist

- [x] Backend accepts Polars expressions
- [x] Backend validates and executes
- [ ] Frontend: Column name input
- [ ] Frontend: Expression textarea
- [ ] Frontend: Column picker dropdown (inserts `pl.col('...')`)
- [ ] Frontend: Operation buttons (>, <, +, -, etc.)
- [ ] Frontend: Pattern dropdown (if/then, uppercase, etc.)
- [ ] Frontend: Preview button
- [ ] Frontend: Error display
- [ ] Frontend: Quick reference card

## Example: Complete Flow

```typescript
// 1. User selects column from dropdown
// -> Inserts: pl.col('age')

// 2. User clicks ">" button
// -> Expression: pl.col('age') >

// 3. User types: 30
// -> Expression: pl.col('age') > 30

// 4. User enters column name: is_adult
// 5. User clicks Preview
// -> Backend executes, shows result

// That's it! Simple and powerful.
```

This gives you 80% of the power with 20% of the complexity. You can always add a visual builder later!
