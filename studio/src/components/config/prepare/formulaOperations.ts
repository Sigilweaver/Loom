/**
 * Formula Operation Catalog
 *
 * Defines all GUI-buildable operations for the Formula tool's Basic mode.
 * Each operation knows:
 * - What column types it applies to
 * - What parameters the user needs to fill in
 * - How to generate a Polars expression from those parameters
 * - How to auto-name the output column
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TypeCategory = "numeric" | "string" | "boolean" | "temporal" | "any";

export type ParamKind =
  | "value" // free-form text/number input
  | "column" // column picker dropdown
  | "column_or_value" // radio toggle between column reference and literal value
  | "select" // dropdown with fixed options
  | "number" // numeric input
  | "boolean" // checkbox / toggle
  | "condition"; // reuse filter-style condition row (for when/then/otherwise)

export interface ParamOption {
  value: string;
  label: string;
}

export interface OperationParam {
  key: string;
  label: string;
  kind: ParamKind;
  placeholder?: string;
  options?: ParamOption[]; // for "select" kind
  defaultValue?: string;
  /** If true, this param is only shown when a certain condition is met */
  showWhen?: (params: Record<string, string>) => boolean;
}

export interface OperationDef {
  id: string;
  label: string;
  category: OperationCategory;
  /** Which column type categories this operation applies to. "any" = always shown. */
  applicableTypes: TypeCategory[];
  /** The parameters the user must fill in (beyond source column selection) */
  params: OperationParam[];
  /** Generate a Polars expression string from source column + filled params */
  toExpression: (sourceColumn: string, params: Record<string, string>) => string;
  /** Auto-generate a descriptive output column name */
  toColumnName: (sourceColumn: string, params: Record<string, string>) => string;
  /** Whether this operation needs a source column. Most do, but some (literal, row_number) don't. */
  needsSourceColumn?: boolean;
}

export type OperationCategory =
  | "math"
  | "text"
  | "datetime"
  | "type"
  | "null"
  | "conditional"
  | "other";

export const OPERATION_CATEGORY_LABELS: Record<OperationCategory, string> = {
  math: "Math",
  text: "Text",
  datetime: "Date / Time",
  type: "Type Casting",
  null: "Null Handling",
  conditional: "Conditional",
  other: "Other",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function colRef(name: string): string {
  return `pl.col("${esc(name)}")`;
}

function valueOrColumn(
  params: Record<string, string>,
  valueKey: string,
  modeKey: string
): string {
  const mode = params[modeKey] || "value";
  const val = params[valueKey] || "0";
  if (mode === "column") return colRef(val);
  // If it looks numeric, use as-is; otherwise wrap in pl.lit()
  if (/^-?\d+(\.\d+)?$/.test(val)) return val;
  return `pl.lit("${esc(val)}")`;
}

// ---------------------------------------------------------------------------
// Operation Definitions
// ---------------------------------------------------------------------------

// ---- Math ----

const MATH_OPS: OperationDef[] = [
  {
    id: "add",
    label: "Add",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      { key: "mode", label: "Add", kind: "select", options: [{ value: "value", label: "Value" }, { value: "column", label: "Column" }], defaultValue: "value" },
      { key: "operand", label: "Value", kind: "column_or_value", placeholder: "0", defaultValue: "0" },
    ],
    toExpression: (src, p) => `${colRef(src)} + ${valueOrColumn(p, "operand", "mode")}`,
    toColumnName: (src) => `${src}_plus`,
  },
  {
    id: "subtract",
    label: "Subtract",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      { key: "mode", label: "Subtract", kind: "select", options: [{ value: "value", label: "Value" }, { value: "column", label: "Column" }], defaultValue: "value" },
      { key: "operand", label: "Value", kind: "column_or_value", placeholder: "0", defaultValue: "0" },
    ],
    toExpression: (src, p) => `${colRef(src)} - ${valueOrColumn(p, "operand", "mode")}`,
    toColumnName: (src) => `${src}_minus`,
  },
  {
    id: "multiply",
    label: "Multiply",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      { key: "mode", label: "Multiply by", kind: "select", options: [{ value: "value", label: "Value" }, { value: "column", label: "Column" }], defaultValue: "value" },
      { key: "operand", label: "Value", kind: "column_or_value", placeholder: "1", defaultValue: "1" },
    ],
    toExpression: (src, p) => `${colRef(src)} * ${valueOrColumn(p, "operand", "mode")}`,
    toColumnName: (src, p) => {
      const mode = p.mode || "value";
      if (mode === "column") return `${src}_x_${p.operand || "col"}`;
      return `${src}_x_${p.operand || "1"}`;
    },
  },
  {
    id: "divide",
    label: "Divide",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      { key: "mode", label: "Divide by", kind: "select", options: [{ value: "value", label: "Value" }, { value: "column", label: "Column" }], defaultValue: "value" },
      { key: "operand", label: "Value", kind: "column_or_value", placeholder: "1", defaultValue: "1" },
    ],
    toExpression: (src, p) => `${colRef(src)} / ${valueOrColumn(p, "operand", "mode")}`,
    toColumnName: (src) => `${src}_div`,
  },
  {
    id: "modulo",
    label: "Modulo",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      { key: "mode", label: "Mod by", kind: "select", options: [{ value: "value", label: "Value" }, { value: "column", label: "Column" }], defaultValue: "value" },
      { key: "operand", label: "Value", kind: "column_or_value", placeholder: "2", defaultValue: "2" },
    ],
    toExpression: (src, p) => `${colRef(src)} % ${valueOrColumn(p, "operand", "mode")}`,
    toColumnName: (src) => `${src}_mod`,
  },
  {
    id: "power",
    label: "Power",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      { key: "exponent", label: "Exponent", kind: "number", placeholder: "2", defaultValue: "2" },
    ],
    toExpression: (src, p) => `${colRef(src)}.pow(${p.exponent || "2"})`,
    toColumnName: (src, p) => `${src}_pow${p.exponent || "2"}`,
  },
  {
    id: "round",
    label: "Round",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      { key: "decimals", label: "Decimal Places", kind: "number", placeholder: "2", defaultValue: "2" },
    ],
    toExpression: (src, p) => `${colRef(src)}.round(${p.decimals || "2"})`,
    toColumnName: (src) => `${src}_rounded`,
  },
  {
    id: "floor",
    label: "Floor",
    category: "math",
    applicableTypes: ["numeric"],
    params: [],
    toExpression: (src) => `${colRef(src)}.floor()`,
    toColumnName: (src) => `${src}_floor`,
  },
  {
    id: "ceil",
    label: "Ceiling",
    category: "math",
    applicableTypes: ["numeric"],
    params: [],
    toExpression: (src) => `${colRef(src)}.ceil()`,
    toColumnName: (src) => `${src}_ceil`,
  },
  {
    id: "abs",
    label: "Absolute Value",
    category: "math",
    applicableTypes: ["numeric"],
    params: [],
    toExpression: (src) => `${colRef(src)}.abs()`,
    toColumnName: (src) => `${src}_abs`,
  },
  {
    id: "sqrt",
    label: "Square Root",
    category: "math",
    applicableTypes: ["numeric"],
    params: [],
    toExpression: (src) => `${colRef(src)}.sqrt()`,
    toColumnName: (src) => `${src}_sqrt`,
  },
  {
    id: "log",
    label: "Logarithm",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      { key: "base", label: "Base", kind: "number", placeholder: "10", defaultValue: "10" },
    ],
    toExpression: (src, p) => `${colRef(src)}.log(${p.base || "10"})`,
    toColumnName: (src, p) => `${src}_log${p.base || "10"}`,
  },
  {
    id: "clip",
    label: "Clip (Clamp)",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      { key: "lower", label: "Min", kind: "number", placeholder: "0" },
      { key: "upper", label: "Max", kind: "number", placeholder: "100" },
    ],
    toExpression: (src, p) => {
      const lower = p.lower || "None";
      const upper = p.upper || "None";
      return `${colRef(src)}.clip(${lower}, ${upper})`;
    },
    toColumnName: (src) => `${src}_clipped`,
  },
  {
    id: "negate",
    label: "Negate",
    category: "math",
    applicableTypes: ["numeric"],
    params: [],
    toExpression: (src) => `-${colRef(src)}`,
    toColumnName: (src) => `${src}_neg`,
  },
  {
    id: "pct_of_total",
    label: "Percent of Total",
    category: "math",
    applicableTypes: ["numeric"],
    params: [],
    toExpression: (src) => `${colRef(src)} / ${colRef(src)}.sum()`,
    toColumnName: (src) => `${src}_pct`,
  },
  {
    id: "cum_sum",
    label: "Cumulative Sum",
    category: "math",
    applicableTypes: ["numeric"],
    params: [],
    toExpression: (src) => `${colRef(src)}.cum_sum()`,
    toColumnName: (src) => `${src}_cumsum`,
  },
  {
    id: "rank",
    label: "Rank",
    category: "math",
    applicableTypes: ["numeric"],
    params: [
      {
        key: "method", label: "Method", kind: "select", defaultValue: "ordinal",
        options: [
          { value: "ordinal", label: "Ordinal (1, 2, 3, ...)" },
          { value: "dense", label: "Dense (no gaps)" },
          { value: "min", label: "Min (ties get lowest)" },
          { value: "max", label: "Max (ties get highest)" },
          { value: "average", label: "Average (tie-break)" },
        ],
      },
    ],
    toExpression: (src, p) => `${colRef(src)}.rank(method="${p.method || "ordinal"}")`,
    toColumnName: (src) => `${src}_rank`,
  },
];

// ---- Text ----

const TEXT_OPS: OperationDef[] = [
  {
    id: "uppercase",
    label: "Uppercase",
    category: "text",
    applicableTypes: ["string"],
    params: [],
    toExpression: (src) => `${colRef(src)}.str.to_uppercase()`,
    toColumnName: (src) => `${src}_upper`,
  },
  {
    id: "lowercase",
    label: "Lowercase",
    category: "text",
    applicableTypes: ["string"],
    params: [],
    toExpression: (src) => `${colRef(src)}.str.to_lowercase()`,
    toColumnName: (src) => `${src}_lower`,
  },
  {
    id: "titlecase",
    label: "Title Case",
    category: "text",
    applicableTypes: ["string"],
    params: [],
    toExpression: (src) => `${colRef(src)}.str.to_titlecase()`,
    toColumnName: (src) => `${src}_title`,
  },
  {
    id: "trim",
    label: "Trim Whitespace",
    category: "text",
    applicableTypes: ["string"],
    params: [
      {
        key: "side", label: "Side", kind: "select", defaultValue: "both",
        options: [
          { value: "both", label: "Both sides" },
          { value: "left", label: "Left only" },
          { value: "right", label: "Right only" },
        ],
      },
    ],
    toExpression: (src, p) => {
      const side = p.side || "both";
      if (side === "left") return `${colRef(src)}.str.lstrip_chars()`;
      if (side === "right") return `${colRef(src)}.str.rstrip_chars()`;
      return `${colRef(src)}.str.strip_chars()`;
    },
    toColumnName: (src) => `${src}_trimmed`,
  },
  {
    id: "replace",
    label: "Replace Text",
    category: "text",
    applicableTypes: ["string"],
    params: [
      { key: "find", label: "Find", kind: "value", placeholder: "old text" },
      { key: "replace_with", label: "Replace With", kind: "value", placeholder: "new text" },
      {
        key: "all", label: "Replace", kind: "select", defaultValue: "all",
        options: [
          { value: "all", label: "All occurrences" },
          { value: "first", label: "First occurrence only" },
        ],
      },
    ],
    toExpression: (src, p) => {
      const find = esc(p.find || "");
      const rep = esc(p.replace_with || "");
      const fn = p.all === "first" ? "replace" : "replace_all";
      return `${colRef(src)}.str.${fn}("${find}", "${rep}")`;
    },
    toColumnName: (src) => `${src}_replaced`,
  },
  {
    id: "slice",
    label: "Slice / Substring",
    category: "text",
    applicableTypes: ["string"],
    params: [
      { key: "offset", label: "Start Position", kind: "number", placeholder: "0", defaultValue: "0" },
      { key: "length", label: "Length", kind: "number", placeholder: "5" },
    ],
    toExpression: (src, p) => {
      const offset = p.offset || "0";
      const length = p.length;
      if (length) return `${colRef(src)}.str.slice(${offset}, ${length})`;
      return `${colRef(src)}.str.slice(${offset})`;
    },
    toColumnName: (src) => `${src}_slice`,
  },
  {
    id: "pad",
    label: "Pad",
    category: "text",
    applicableTypes: ["string"],
    params: [
      {
        key: "side", label: "Side", kind: "select", defaultValue: "left",
        options: [
          { value: "left", label: "Pad left" },
          { value: "right", label: "Pad right" },
        ],
      },
      { key: "width", label: "Width", kind: "number", placeholder: "10", defaultValue: "10" },
      { key: "fillchar", label: "Fill Character", kind: "value", placeholder: "0", defaultValue: " " },
    ],
    toExpression: (src, p) => {
      const width = p.width || "10";
      const fill = esc(p.fillchar || " ");
      const fn = p.side === "right" ? "pad_end" : "pad_start";
      return `${colRef(src)}.str.${fn}(${width}, "${fill}")`;
    },
    toColumnName: (src, p) => `${src}_padded${p.side === "right" ? "_r" : ""}`,
  },
  {
    id: "length",
    label: "String Length",
    category: "text",
    applicableTypes: ["string"],
    params: [],
    toExpression: (src) => `${colRef(src)}.str.len_chars()`,
    toColumnName: (src) => `${src}_len`,
  },
  {
    id: "contains",
    label: "Contains (Boolean)",
    category: "text",
    applicableTypes: ["string"],
    params: [
      { key: "pattern", label: "Pattern", kind: "value", placeholder: "search text" },
    ],
    toExpression: (src, p) => `${colRef(src)}.str.contains("${esc(p.pattern || "")}")`,
    toColumnName: (src, p) => `${src}_has_${(p.pattern || "pattern").replace(/\s+/g, "_").slice(0, 20)}`,
  },
  {
    id: "starts_with",
    label: "Starts With (Boolean)",
    category: "text",
    applicableTypes: ["string"],
    params: [
      { key: "prefix", label: "Prefix", kind: "value", placeholder: "prefix" },
    ],
    toExpression: (src, p) => `${colRef(src)}.str.starts_with("${esc(p.prefix || "")}")`,
    toColumnName: (src) => `${src}_starts`,
  },
  {
    id: "ends_with",
    label: "Ends With (Boolean)",
    category: "text",
    applicableTypes: ["string"],
    params: [
      { key: "suffix", label: "Suffix", kind: "value", placeholder: "suffix" },
    ],
    toExpression: (src, p) => `${colRef(src)}.str.ends_with("${esc(p.suffix || "")}")`,
    toColumnName: (src) => `${src}_ends`,
  },
  {
    id: "extract",
    label: "Extract (Regex)",
    category: "text",
    applicableTypes: ["string"],
    params: [
      { key: "pattern", label: "Regex Pattern", kind: "value", placeholder: "(\\d+)" },
      { key: "group", label: "Group Index", kind: "number", placeholder: "1", defaultValue: "1" },
    ],
    toExpression: (src, p) => `${colRef(src)}.str.extract("${esc(p.pattern || "")}", ${p.group || "1"})`,
    toColumnName: (src) => `${src}_extracted`,
  },
  {
    id: "split_get",
    label: "Split & Get",
    category: "text",
    applicableTypes: ["string"],
    params: [
      { key: "delimiter", label: "Delimiter", kind: "value", placeholder: ",", defaultValue: "," },
      { key: "index", label: "Index (0-based)", kind: "number", placeholder: "0", defaultValue: "0" },
    ],
    toExpression: (src, p) => `${colRef(src)}.str.split("${esc(p.delimiter || ",")}").list.get(${p.index || "0"})`,
    toColumnName: (src, p) => `${src}_part${p.index || "0"}`,
  },
  {
    id: "concatenate",
    label: "Concatenate Columns",
    category: "text",
    applicableTypes: ["string"],
    params: [
      { key: "other_column", label: "Other Column", kind: "column_or_value", placeholder: "column name" },
      { key: "mode", label: "Join with", kind: "select", options: [{ value: "column", label: "Column" }, { value: "value", label: "Literal" }], defaultValue: "column" },
      { key: "separator", label: "Separator", kind: "value", placeholder: " ", defaultValue: " " },
    ],
    toExpression: (src, p) => {
      const sep = esc(p.separator ?? " ");
      const other = p.mode === "value"
        ? `pl.lit("${esc(p.other_column || "")}")`
        : colRef(p.other_column || "");
      if (sep) {
        return `${colRef(src)} + pl.lit("${sep}") + ${other}`;
      }
      return `${colRef(src)} + ${other}`;
    },
    toColumnName: (src, p) => `${src}_${p.other_column || "concat"}`,
  },
];

// ---- Date/Time ----

const DATETIME_OPS: OperationDef[] = [
  {
    id: "dt_year",
    label: "Extract Year",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [],
    toExpression: (src) => `${colRef(src)}.dt.year()`,
    toColumnName: (src) => `${src}_year`,
  },
  {
    id: "dt_month",
    label: "Extract Month",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [],
    toExpression: (src) => `${colRef(src)}.dt.month()`,
    toColumnName: (src) => `${src}_month`,
  },
  {
    id: "dt_day",
    label: "Extract Day",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [],
    toExpression: (src) => `${colRef(src)}.dt.day()`,
    toColumnName: (src) => `${src}_day`,
  },
  {
    id: "dt_hour",
    label: "Extract Hour",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [],
    toExpression: (src) => `${colRef(src)}.dt.hour()`,
    toColumnName: (src) => `${src}_hour`,
  },
  {
    id: "dt_minute",
    label: "Extract Minute",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [],
    toExpression: (src) => `${colRef(src)}.dt.minute()`,
    toColumnName: (src) => `${src}_minute`,
  },
  {
    id: "dt_second",
    label: "Extract Second",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [],
    toExpression: (src) => `${colRef(src)}.dt.second()`,
    toColumnName: (src) => `${src}_second`,
  },
  {
    id: "dt_weekday",
    label: "Day of Week",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [],
    toExpression: (src) => `${colRef(src)}.dt.weekday()`,
    toColumnName: (src) => `${src}_weekday`,
  },
  {
    id: "dt_truncate",
    label: "Truncate",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [
      {
        key: "every", label: "Truncate To", kind: "select", defaultValue: "1mo",
        options: [
          { value: "1h", label: "Hour" },
          { value: "1d", label: "Day" },
          { value: "1w", label: "Week" },
          { value: "1mo", label: "Month" },
          { value: "1q", label: "Quarter" },
          { value: "1y", label: "Year" },
        ],
      },
    ],
    toExpression: (src, p) => `${colRef(src)}.dt.truncate("${p.every || "1mo"}")`,
    toColumnName: (src, p) => `${src}_trunc_${p.every || "1mo"}`,
  },
  {
    id: "dt_format",
    label: "Format Date",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [
      { key: "format", label: "Format String", kind: "value", placeholder: "%Y-%m-%d", defaultValue: "%Y-%m-%d" },
    ],
    toExpression: (src, p) => `${colRef(src)}.dt.strftime("${esc(p.format || "%Y-%m-%d")}")`,
    toColumnName: (src) => `${src}_formatted`,
  },
  {
    id: "dt_diff",
    label: "Date Difference",
    category: "datetime",
    applicableTypes: ["temporal"],
    params: [
      { key: "other_column", label: "Other Date Column", kind: "column_or_value", placeholder: "other_date" },
      { key: "mode", label: "Compare with", kind: "select", options: [{ value: "column", label: "Column" }], defaultValue: "column" },
      {
        key: "unit", label: "Unit", kind: "select", defaultValue: "days",
        options: [
          { value: "days", label: "Days" },
          { value: "hours", label: "Hours" },
          { value: "minutes", label: "Minutes" },
          { value: "seconds", label: "Seconds" },
        ],
      },
    ],
    toExpression: (src, p) => {
      const other = colRef(p.other_column || src);
      const unitFn = `total_${p.unit || "days"}`;
      return `(${colRef(src)} - ${other}).dt.${unitFn}()`;
    },
    toColumnName: (src, p) => `${src}_diff_${p.unit || "days"}`,
  },
];

// ---- Type Casting ----

const TYPE_OPS: OperationDef[] = [
  {
    id: "cast",
    label: "Cast Type",
    category: "type",
    applicableTypes: ["any"],
    params: [
      {
        key: "target_type", label: "Target Type", kind: "select", defaultValue: "Float64",
        options: [
          { value: "Int32", label: "Integer (32-bit)" },
          { value: "Int64", label: "Integer (64-bit)" },
          { value: "Float32", label: "Float (32-bit)" },
          { value: "Float64", label: "Float (64-bit)" },
          { value: "String", label: "String" },
          { value: "Boolean", label: "Boolean" },
          { value: "Date", label: "Date" },
          { value: "Datetime", label: "Datetime" },
        ],
      },
    ],
    toExpression: (src, p) => `${colRef(src)}.cast(pl.${p.target_type || "Float64"})`,
    toColumnName: (src, p) => `${src}_as_${(p.target_type || "Float64").toLowerCase()}`,
  },
  {
    id: "parse_date",
    label: "Parse Date from String",
    category: "type",
    applicableTypes: ["string"],
    params: [
      { key: "format", label: "Date Format", kind: "value", placeholder: "%Y-%m-%d", defaultValue: "%Y-%m-%d" },
    ],
    toExpression: (src, p) => `${colRef(src)}.str.to_date("${esc(p.format || "%Y-%m-%d")}")`,
    toColumnName: (src) => `${src}_date`,
  },
  {
    id: "parse_datetime",
    label: "Parse DateTime from String",
    category: "type",
    applicableTypes: ["string"],
    params: [
      { key: "format", label: "DateTime Format", kind: "value", placeholder: "%Y-%m-%d %H:%M:%S", defaultValue: "%Y-%m-%d %H:%M:%S" },
    ],
    toExpression: (src, p) => `${colRef(src)}.str.to_datetime("${esc(p.format || "%Y-%m-%d %H:%M:%S")}")`,
    toColumnName: (src) => `${src}_datetime`,
  },
];

// ---- Null Handling ----

const NULL_OPS: OperationDef[] = [
  {
    id: "fill_null_value",
    label: "Fill Null (Value)",
    category: "null",
    applicableTypes: ["any"],
    params: [
      { key: "value", label: "Fill Value", kind: "value", placeholder: "0" },
    ],
    toExpression: (src, p) => {
      const val = p.value || "0";
      if (/^-?\d+(\.\d+)?$/.test(val)) return `${colRef(src)}.fill_null(${val})`;
      return `${colRef(src)}.fill_null("${esc(val)}")`;
    },
    toColumnName: (src) => `${src}_filled`,
  },
  {
    id: "fill_null_strategy",
    label: "Fill Null (Strategy)",
    category: "null",
    applicableTypes: ["any"],
    params: [
      {
        key: "strategy", label: "Strategy", kind: "select", defaultValue: "forward",
        options: [
          { value: "forward", label: "Forward fill" },
          { value: "backward", label: "Backward fill" },
          { value: "mean", label: "Mean" },
          { value: "min", label: "Min" },
          { value: "max", label: "Max" },
          { value: "zero", label: "Zero" },
        ],
      },
    ],
    toExpression: (src, p) => `${colRef(src)}.fill_null(strategy="${p.strategy || "forward"}")`,
    toColumnName: (src, p) => `${src}_fill_${p.strategy || "fwd"}`,
  },
  {
    id: "coalesce",
    label: "Coalesce (First Non-Null)",
    category: "null",
    applicableTypes: ["any"],
    params: [
      { key: "other_column", label: "Fallback Column", kind: "column_or_value", placeholder: "column name" },
      { key: "mode", label: "Fallback type", kind: "select", options: [{ value: "column", label: "Column" }, { value: "value", label: "Literal" }], defaultValue: "column" },
    ],
    toExpression: (src, p) => {
      const other = p.mode === "value"
        ? `pl.lit("${esc(p.other_column || "")}")`
        : colRef(p.other_column || "");
      return `pl.coalesce(${colRef(src)}, ${other})`;
    },
    toColumnName: (src) => `${src}_coalesce`,
  },
  {
    id: "is_null",
    label: "Is Null (Boolean)",
    category: "null",
    applicableTypes: ["any"],
    params: [],
    toExpression: (src) => `${colRef(src)}.is_null()`,
    toColumnName: (src) => `${src}_is_null`,
  },
  {
    id: "is_not_null",
    label: "Is Not Null (Boolean)",
    category: "null",
    applicableTypes: ["any"],
    params: [],
    toExpression: (src) => `${colRef(src)}.is_not_null()`,
    toColumnName: (src) => `${src}_not_null`,
  },
];

// ---- Conditional ----

const CONDITIONAL_OPS: OperationDef[] = [
  {
    id: "if_then_else",
    label: "If / Then / Else",
    category: "conditional",
    applicableTypes: ["any"],
    params: [
      { key: "condition_col", label: "Column", kind: "column_or_value" },
      { key: "condition_mode", label: "", kind: "select", options: [{ value: "column", label: "Column" }], defaultValue: "column" },
      {
        key: "condition_op", label: "Operator", kind: "select", defaultValue: "gt",
        options: [
          { value: "gt", label: ">" },
          { value: "gte", label: ">=" },
          { value: "lt", label: "<" },
          { value: "lte", label: "<=" },
          { value: "eq", label: "==" },
          { value: "neq", label: "!=" },
          { value: "is_null", label: "is null" },
          { value: "is_not_null", label: "is not null" },
        ],
      },
      { key: "condition_value", label: "Value", kind: "value", placeholder: "0" },
      { key: "then_value", label: "Then", kind: "value", placeholder: "result if true" },
      { key: "else_value", label: "Else", kind: "value", placeholder: "result if false" },
    ],
    toExpression: (src, p) => {
      const col = colRef(p.condition_col || src);
      const op = p.condition_op || "gt";
      const cv = p.condition_value || "0";
      let condition: string;
      if (op === "is_null") condition = `${col}.is_null()`;
      else if (op === "is_not_null") condition = `${col}.is_not_null()`;
      else {
        const opStr = { gt: ">", gte: ">=", lt: "<", lte: "<=", eq: "==", neq: "!=" }[op] || ">";
        const fmtV = /^-?\d+(\.\d+)?$/.test(cv) ? cv : `"${esc(cv)}"`;
        condition = `${col} ${opStr} ${fmtV}`;
      }
      const thenV = /^-?\d+(\.\d+)?$/.test(p.then_value || "") ? p.then_value : `pl.lit("${esc(p.then_value || "")}")`;
      const elseV = /^-?\d+(\.\d+)?$/.test(p.else_value || "") ? p.else_value : `pl.lit("${esc(p.else_value || "")}")`;
      return `pl.when(${condition}).then(${thenV}).otherwise(${elseV})`;
    },
    toColumnName: () => `condition_result`,
    needsSourceColumn: false,
  },
  {
    id: "map_values",
    label: "Map / Replace Values",
    category: "conditional",
    applicableTypes: ["any"],
    params: [
      { key: "old_value", label: "Old Value", kind: "value", placeholder: "old" },
      { key: "new_value", label: "New Value", kind: "value", placeholder: "new" },
    ],
    toExpression: (src, p) => {
      const old = esc(p.old_value || "");
      const nw = esc(p.new_value || "");
      return `${colRef(src)}.replace({"${old}": "${nw}"})`;
    },
    toColumnName: (src) => `${src}_mapped`,
  },
];

// ---- Other ----

const OTHER_OPS: OperationDef[] = [
  {
    id: "row_number",
    label: "Row Number",
    category: "other",
    applicableTypes: ["any"],
    params: [],
    needsSourceColumn: false,
    toExpression: () => `pl.int_range(pl.len())`,
    toColumnName: () => `row_number`,
  },
  {
    id: "literal",
    label: "Literal Value",
    category: "other",
    applicableTypes: ["any"],
    params: [
      { key: "value", label: "Value", kind: "value", placeholder: "constant" },
    ],
    needsSourceColumn: false,
    toExpression: (_src, p) => {
      const val = p.value || "";
      if (/^-?\d+(\.\d+)?$/.test(val)) return `pl.lit(${val})`;
      return `pl.lit("${esc(val)}")`;
    },
    toColumnName: () => `constant`,
  },
  {
    id: "shift",
    label: "Shift (Lag/Lead)",
    category: "other",
    applicableTypes: ["any"],
    params: [
      { key: "periods", label: "Periods (negative = lead)", kind: "number", placeholder: "1", defaultValue: "1" },
    ],
    toExpression: (src, p) => `${colRef(src)}.shift(${p.periods || "1"})`,
    toColumnName: (src, p) => {
      const n = parseInt(p.periods || "1", 10);
      return n >= 0 ? `${src}_lag${n}` : `${src}_lead${Math.abs(n)}`;
    },
  },
];

// ---------------------------------------------------------------------------
// Aggregate Catalog
// ---------------------------------------------------------------------------

export const ALL_OPERATIONS: OperationDef[] = [
  ...MATH_OPS,
  ...TEXT_OPS,
  ...DATETIME_OPS,
  ...TYPE_OPS,
  ...NULL_OPS,
  ...CONDITIONAL_OPS,
  ...OTHER_OPS,
];

export const OPERATIONS_BY_ID: Record<string, OperationDef> = Object.fromEntries(
  ALL_OPERATIONS.map((op) => [op.id, op])
);

// ---------------------------------------------------------------------------
// Type category helpers (shared with Filter)
// ---------------------------------------------------------------------------

export function getTypeCategory(dtype: string): TypeCategory {
  if (/^(Int|UInt|Float)\d+$/.test(dtype) || dtype.startsWith("Decimal"))
    return "numeric";
  if (dtype === "String" || dtype === "Utf8") return "string";
  if (dtype === "Boolean") return "boolean";
  if (["Date", "Datetime", "Time", "Duration"].includes(dtype))
    return "temporal";
  return "any";
}

/** Get operations valid for a given column dtype */
export function getOperationsForDtype(dtype: string): OperationDef[] {
  const cat = getTypeCategory(dtype);
  return ALL_OPERATIONS.filter(
    (op) => op.applicableTypes.includes("any") || op.applicableTypes.includes(cat)
  );
}

/** Get operations grouped by category for a given dtype */
export function getOperationsGroupedForDtype(
  dtype: string
): { category: OperationCategory; label: string; operations: OperationDef[] }[] {
  const valid = getOperationsForDtype(dtype);
  const groups: Map<OperationCategory, OperationDef[]> = new Map();
  for (const op of valid) {
    const existing = groups.get(op.category) || [];
    existing.push(op);
    groups.set(op.category, existing);
  }

  const result: { category: OperationCategory; label: string; operations: OperationDef[] }[] = [];
  const order: OperationCategory[] = ["math", "text", "datetime", "type", "null", "conditional", "other"];
  for (const cat of order) {
    const ops = groups.get(cat);
    if (ops && ops.length > 0) {
      result.push({ category: cat, label: OPERATION_CATEGORY_LABELS[cat], operations: ops });
    }
  }
  return result;
}
