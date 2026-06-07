import { useState, useMemo, useCallback } from "react";
import { Plus, X, Layers, Loader2, MessageSquare } from "lucide-react";
import type { ColumnSchema } from "@api/backend";

// --- Types ---

/** Legacy flat condition (still used for backward compat in config) */
export interface FilterCondition {
  id: string;
  column: string;
  operator: string;
  value: string;
  comment?: string | undefined;
}

export type Combinator = "and" | "or";

/** A leaf condition in the tree */
export interface FilterConditionItem {
  id: string;
  type: "condition";
  column: string;
  operator: string;
  value: string;
  /** Optional inline comment shown as # comment in generated expression */
  comment?: string | undefined;
}

/** A group of items sharing a combinator */
export interface FilterGroup {
  id: string;
  type: "group";
  combinator: Combinator;
  children: FilterItem[];
  /** Optional comment shown above the group expression */
  comment?: string | undefined;
}

/** A node in the filter tree */
export type FilterItem = FilterConditionItem | FilterGroup;

interface OperatorDef {
  value: string;
  label: string;
  needsValue: boolean;
}

// --- Operator definitions by type category ---

const NUMERIC_OPERATORS: OperatorDef[] = [
  { value: "eq", label: "equals", needsValue: true },
  { value: "neq", label: "does not equal", needsValue: true },
  { value: "gt", label: "is greater than", needsValue: true },
  { value: "lt", label: "is less than", needsValue: true },
  { value: "gte", label: "is at least", needsValue: true },
  { value: "lte", label: "is at most", needsValue: true },
  { value: "is_null", label: "is null", needsValue: false },
  { value: "is_not_null", label: "is not null", needsValue: false },
];

const STRING_OPERATORS: OperatorDef[] = [
  { value: "eq", label: "equals", needsValue: true },
  { value: "neq", label: "does not equal", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "not_contains", label: "does not contain", needsValue: true },
  { value: "starts_with", label: "starts with", needsValue: true },
  { value: "ends_with", label: "ends with", needsValue: true },
  { value: "is_null", label: "is null", needsValue: false },
  { value: "is_not_null", label: "is not null", needsValue: false },
];

const BOOLEAN_OPERATORS: OperatorDef[] = [
  { value: "is_true", label: "is true", needsValue: false },
  { value: "is_false", label: "is false", needsValue: false },
  { value: "is_null", label: "is null", needsValue: false },
  { value: "is_not_null", label: "is not null", needsValue: false },
];

const TEMPORAL_OPERATORS: OperatorDef[] = [
  { value: "eq", label: "equals", needsValue: true },
  { value: "neq", label: "does not equal", needsValue: true },
  { value: "gt", label: "is after", needsValue: true },
  { value: "lt", label: "is before", needsValue: true },
  { value: "gte", label: "is on or after", needsValue: true },
  { value: "lte", label: "is on or before", needsValue: true },
  { value: "is_null", label: "is null", needsValue: false },
  { value: "is_not_null", label: "is not null", needsValue: false },
];

const DEFAULT_OPERATORS: OperatorDef[] = [
  { value: "eq", label: "equals", needsValue: true },
  { value: "neq", label: "does not equal", needsValue: true },
  { value: "is_null", label: "is null", needsValue: false },
  { value: "is_not_null", label: "is not null", needsValue: false },
];

// Max nested depth for groups (root = 0)
const MAX_DEPTH = 2;

// Left-border colors per nesting depth
const DEPTH_BORDER_COLORS = [
  "border-l-theme-interactive-accent",
  "border-l-amber-500/60",
  "border-l-emerald-500/60",
];

// --- Helpers ---

function getTypeCategory(
  dtype: string
): "numeric" | "string" | "boolean" | "temporal" | "other" {
  if (/^(Int|UInt|Float)\d+$/.test(dtype) || dtype.startsWith("Decimal"))
    return "numeric";
  if (dtype === "String" || dtype === "Utf8") return "string";
  if (dtype === "Boolean") return "boolean";
  if (["Date", "Datetime", "Time", "Duration"].includes(dtype))
    return "temporal";
  return "other";
}

function getOperatorsForDtype(dtype: string): OperatorDef[] {
  switch (getTypeCategory(dtype)) {
    case "numeric":
      return NUMERIC_OPERATORS;
    case "string":
      return STRING_OPERATORS;
    case "boolean":
      return BOOLEAN_OPERATORS;
    case "temporal":
      return TEMPORAL_OPERATORS;
    default:
      return DEFAULT_OPERATORS;
  }
}

function escapeString(str: string): string {
  return str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function formatValue(value: string, dtype: string): string {
  const category = getTypeCategory(dtype);
  switch (category) {
    case "numeric":
      return value !== "" && !isNaN(Number(value))
        ? value
        : `"${escapeString(value)}"`;
    case "string":
      return `"${escapeString(value)}"`;
    case "temporal":
      return `"${escapeString(value)}"`;
    default:
      return `"${escapeString(value)}"`;
  }
}

function conditionToExpression(
  condition: FilterConditionItem,
  columns: ColumnSchema[]
): string | null {
  if (!condition.column) return null;

  const col = columns.find((c) => c.name === condition.column);
  const dtype = col?.dtype || "String";
  const operators = getOperatorsForDtype(dtype);
  const opDef = operators.find((op) => op.value === condition.operator);

  if (opDef?.needsValue && !condition.value.trim()) return null;

  const colRef = `pl.col("${escapeString(condition.column)}")`;

  switch (condition.operator) {
    case "eq":
      return `${colRef} == ${formatValue(condition.value, dtype)}`;
    case "neq":
      return `${colRef} != ${formatValue(condition.value, dtype)}`;
    case "gt":
      return `${colRef} > ${formatValue(condition.value, dtype)}`;
    case "lt":
      return `${colRef} < ${formatValue(condition.value, dtype)}`;
    case "gte":
      return `${colRef} >= ${formatValue(condition.value, dtype)}`;
    case "lte":
      return `${colRef} <= ${formatValue(condition.value, dtype)}`;
    case "contains":
      return `${colRef}.str.contains("${escapeString(condition.value)}")`;
    case "not_contains":
      return `~(${colRef}.str.contains("${escapeString(condition.value)}"))`;
    case "starts_with":
      return `${colRef}.str.starts_with("${escapeString(condition.value)}")`;
    case "ends_with":
      return `${colRef}.str.ends_with("${escapeString(condition.value)}")`;
    case "is_true":
      return `${colRef} == True`;
    case "is_false":
      return `${colRef} == False`;
    case "is_null":
      return `${colRef}.is_null()`;
    case "is_not_null":
      return `${colRef}.is_not_null()`;
    default:
      return null;
  }
}

/** An expression part with optional inline comment */
interface ExprPart {
  expr: string;
  comment?: string | undefined;
}

/** Generate a Polars expression from a filter group tree */
function groupToExpression(
  group: FilterGroup,
  columns: ColumnSchema[]
): string {
  const parts: ExprPart[] = [];

  for (const child of group.children) {
    if (child.type === "condition") {
      const expr = conditionToExpression(child, columns);
      if (expr) parts.push({ expr, comment: child.comment });
    } else {
      const subExpr = groupToExpression(child, columns);
      if (subExpr) {
        // Sub-group comment becomes a leading # line above the sub-expression
        parts.push({ expr: subExpr, comment: child.comment });
      }
    }
  }

  if (parts.length === 0) return "";
  if (parts.length === 1) {
    const p = parts[0]!;
    if (p.comment) return `# ${p.comment}\n${p.expr}`;
    return p.expr;
  }

  // Follow documented best-practice multi-line style with blank lines
  // between parts for readability:
  //
  // (expr1  # inline comment
  //
  // ) & (# group comment
  // sub-expr
  //
  // )
  const op = group.combinator === "and" ? "&" : "|";
  const lines: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]!;
    const isFirst = i === 0;
    const prefix = isFirst ? "(" : `) ${op} (`;

    if (p.comment) {
      // Comment goes above the expression on its own line
      if (isFirst) {
        lines.push(`(# ${p.comment}`);
        lines.push(p.expr);
      } else {
        lines.push(``) // blank line separator
        lines.push(`${prefix}# ${p.comment}`);
        lines.push(p.expr);
      }
    } else {
      if (!isFirst) lines.push(``); // blank line separator
      lines.push(`${prefix}${p.expr}`);
    }
  }
  lines.push(`)`);
  return lines.join("\n");
}

// --- Legacy compatibility ---

/**
 * Generate expression from flat conditions (legacy, kept for backward compat).
 */
export function generateExpression(
  conditions: FilterCondition[],
  combinator: Combinator,
  columns: ColumnSchema[]
): string {
  const group = legacyToGroup(conditions, combinator);
  return groupToExpression(group, columns);
}

/** Generate expression from a filter group tree */
export function generateGroupExpression(
  group: FilterGroup,
  columns: ColumnSchema[]
): string {
  return groupToExpression(group, columns);
}

/** Convert legacy flat conditions array to a FilterGroup */
export function legacyToGroup(
  conditions: FilterCondition[],
  combinator: Combinator
): FilterGroup {
  return {
    id: crypto.randomUUID(),
    type: "group",
    combinator,
    children: conditions.map((c) => ({
      id: c.id || crypto.randomUUID(),
      type: "condition" as const,
      column: c.column,
      operator: c.operator,
      value: c.value,
      comment: c.comment,
    })),
  };
}

/** Flatten a filter group back to legacy format (for config serialization) */
export function groupToLegacy(group: FilterGroup): {
  conditions: FilterCondition[];
  combinator: Combinator;
} {
  // Only flatten if it's a simple (non-nested) group
  const isFlat = group.children.every((c) => c.type === "condition");
  if (isFlat) {
    return {
      conditions: group.children.map((c) => {
        const cond = c as FilterConditionItem;
        return {
          id: cond.id,
          column: cond.column,
          operator: cond.operator,
          value: cond.value,
          ...(cond.comment ? { comment: cond.comment } : {}),
        };
      }),
      combinator: group.combinator,
    };
  }
  // For nested groups, we can't flatten - store conditions as empty and rely on conditionGroup
  return { conditions: [], combinator: group.combinator };
}

/** Check if the group has any nested sub-groups */
export function hasNestedGroups(group: FilterGroup): boolean {
  return group.children.some((c) => c.type === "group");
}

// --- Value Input ---

interface ValueInputProps {
  value: string;
  dtype: string;
  onChange: (value: string) => void;
}

function ValueInput({ value, dtype, onChange }: ValueInputProps) {
  const category = getTypeCategory(dtype);

  if (category === "boolean") {
    return (
      <select
        value={value || "true"}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 min-w-0 h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
      >
        <option value="true">True</option>
        <option value="false">False</option>
      </select>
    );
  }

  const placeholder =
    category === "numeric"
      ? "Value..."
      : category === "temporal"
        ? "YYYY-MM-DD..."
        : "Value...";

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`flex-1 min-w-0 h-7 px-2 text-xs rounded border ${
        !value.trim()
          ? "border-theme-status-warning-border"
          : "border-theme-border-primary"
      } bg-theme-surface-panel text-theme-text-primary placeholder:text-theme-text-tertiary`}
    />
  );
}

// --- Combinator Badge (clickable toggle between conditions) ---

interface CombinatorBadgeProps {
  combinator: Combinator;
  onClick: () => void;
}

function CombinatorBadge({ combinator, onClick }: CombinatorBadgeProps) {
  return (
    <div className="flex justify-center py-0.5">
      <button
        type="button"
        onClick={onClick}
        className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full transition-colors cursor-pointer select-none hover:opacity-80"
        style={{
          backgroundColor:
            combinator === "and"
              ? "var(--theme-interactive-accent)"
              : "var(--theme-log-warning, #d97706)",
          color: "white",
          opacity: 0.85,
        }}
        title={`Click to switch to ${combinator === "and" ? "OR" : "AND"}`}
      >
        {combinator === "and" ? "AND" : "OR"}
      </button>
    </div>
  );
}

// --- Condition Row (compact horizontal layout) ---

interface ConditionRowProps {
  condition: FilterConditionItem;
  columns: ColumnSchema[];
  onChange: (updates: Partial<FilterConditionItem>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function ConditionRow({
  condition,
  columns,
  onChange,
  onRemove,
  canRemove,
}: ConditionRowProps) {
  const [showComment, setShowComment] = useState(
    () => !!condition.comment
  );
  const selectedColumn = columns.find((c) => c.name === condition.column);
  const dtype = selectedColumn?.dtype || "String";
  const operators = useMemo(() => getOperatorsForDtype(dtype), [dtype]);
  const currentOperator = operators.find(
    (op) => op.value === condition.operator
  );
  const needsValue = currentOperator?.needsValue ?? true;

  const handleColumnChange = (columnName: string) => {
    const newCol = columns.find((c) => c.name === columnName);
    const newDtype = newCol?.dtype || "String";
    const newOperators = getOperatorsForDtype(newDtype);
    const operatorStillValid = newOperators.some(
      (op) => op.value === condition.operator
    );

    onChange({
      column: columnName,
      ...(operatorStillValid
        ? {}
        : { operator: newOperators[0]?.value || "eq", value: "" }),
    });
  };

  const handleOperatorChange = (operator: string) => {
    const opDef = operators.find((op) => op.value === operator);
    onChange({
      operator,
      ...(opDef?.needsValue ? {} : { value: "" }),
    });
  };

  return (
    <div className="flex flex-col gap-1 p-2 bg-theme-surface-elevated rounded border border-theme-border-secondary">
      {/* Row 1: Column + Comment toggle + Remove */}
      <div className="flex gap-1.5 items-center">
        <select
          value={condition.column}
          onChange={(e) => handleColumnChange(e.target.value)}
          className="flex-1 min-w-0 h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary"
        >
          <option value="" disabled>
            Column...
          </option>
          {columns.map((col) => (
            <option key={col.name} value={col.name}>
              {col.name} ({col.dtype})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (showComment) {
              // Clear comment when hiding
              onChange({ comment: undefined });
            }
            setShowComment(!showComment);
          }}
          className={`flex-none h-7 w-7 flex items-center justify-center rounded transition-colors ${
            showComment || condition.comment
              ? "text-theme-interactive-accent hover:text-theme-interactive-accent-hover"
              : "text-theme-text-tertiary hover:text-theme-text-secondary hover:bg-theme-bg-hover"
          }`}
          title={showComment ? "Remove comment" : "Add comment"}
        >
          <MessageSquare className="h-3.5 w-3.5" />
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex-none h-7 w-7 flex items-center justify-center rounded text-theme-text-tertiary hover:text-theme-status-error-text hover:bg-theme-bg-hover transition-colors"
            title="Remove condition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Row 2: Operator + Value */}
      <div className="flex gap-1.5 items-center">
        <select
          value={condition.operator}
          onChange={(e) => handleOperatorChange(e.target.value)}
          className={`h-7 px-2 text-xs rounded border border-theme-border-primary bg-theme-surface-panel text-theme-text-primary ${needsValue ? "w-[45%] flex-none" : "flex-1"}`}
        >
          {operators.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>

        {needsValue && (
          <ValueInput
            value={condition.value}
            dtype={dtype}
            onChange={(value) => onChange({ value })}
          />
        )}
      </div>

      {/* Row 3: Comment (optional) */}
      {showComment && (
        <div className="flex gap-1.5 items-center">
          <span className="text-[10px] text-theme-text-tertiary font-mono select-none">#</span>
          <input
            type="text"
            value={condition.comment || ""}
            onChange={(e) => onChange({ comment: e.target.value || undefined })}
            placeholder="Describe this condition..."
            className="flex-1 min-w-0 h-6 px-2 text-xs rounded border border-theme-border-secondary bg-transparent text-theme-text-secondary placeholder:text-theme-text-tertiary italic"
          />
        </div>
      )}
    </div>
  );
}

// --- Condition Group (recursive) ---

interface ConditionGroupProps {
  group: FilterGroup;
  columns: ColumnSchema[];
  onChange: (group: FilterGroup) => void;
  onRemove?: () => void;
  depth: number;
  hasInput?: boolean;
  loading?: boolean;
}

function ConditionGroup({
  group,
  columns,
  onChange,
  onRemove,
  depth,
  hasInput = false,
  loading = false,
}: ConditionGroupProps) {
  const [showGroupComment, setShowGroupComment] = useState(
    () => !!group.comment
  );
  const isSubGroup = depth > 0;
  const borderColor =
    DEPTH_BORDER_COLORS[depth % DEPTH_BORDER_COLORS.length] ??
    DEPTH_BORDER_COLORS[0];

  const toggleCombinator = useCallback(() => {
    onChange({
      ...group,
      combinator: group.combinator === "and" ? "or" : "and",
    });
  }, [group, onChange]);

  const addCondition = useCallback(() => {
    const firstColumn = columns[0];
    const newCondition: FilterConditionItem = {
      id: crypto.randomUUID(),
      type: "condition",
      column: firstColumn?.name ?? "",
      operator: "eq",
      value: "",
    };
    onChange({ ...group, children: [...group.children, newCondition] });
  }, [group, columns, onChange]);

  const addGroup = useCallback(() => {
    const firstColumn = columns[0];
    const newGroup: FilterGroup = {
      id: crypto.randomUUID(),
      type: "group",
      // Default to opposite combinator for visual clarity
      combinator: group.combinator === "and" ? "or" : "and",
      children: [
        {
          id: crypto.randomUUID(),
          type: "condition",
          column: firstColumn?.name ?? "",
          operator: "eq",
          value: "",
        },
      ],
    };
    onChange({ ...group, children: [...group.children, newGroup] });
  }, [group, columns, onChange]);

  const removeChild = useCallback(
    (childId: string) => {
      const newChildren = group.children.filter((c) => c.id !== childId);
      onChange({ ...group, children: newChildren });
    },
    [group, onChange]
  );

  const updateChild = useCallback(
    (childId: string, updated: FilterItem) => {
      onChange({
        ...group,
        children: group.children.map((c) =>
          c.id === childId ? updated : c
        ),
      });
    },
    [group, onChange]
  );

  const updateCondition = useCallback(
    (childId: string, updates: Partial<FilterConditionItem>) => {
      onChange({
        ...group,
        children: group.children.map((c): FilterItem =>
          c.id === childId ? { ...c, ...updates } as FilterItem : c
        ),
      });
    },
    [group, onChange]
  );

  const canRemoveChild = group.children.length > 1 || depth > 0;

  return (
    <div
      className={`rounded border border-theme-border-secondary border-l-2 ${borderColor} ${depth > 0 ? "bg-theme-bg-primary/50" : ""}`}
    >
      {/* Group header */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-theme-surface-elevated/50 rounded-t border-b border-theme-border-secondary">
        <div className="flex items-center gap-1.5 text-xs text-theme-text-secondary">
          <span className="text-theme-text-tertiary">Where</span>
          <button
            type="button"
            onClick={toggleCombinator}
            className="h-5 px-2 text-[11px] font-semibold rounded transition-colors cursor-pointer select-none"
            style={{
              backgroundColor:
                group.combinator === "and"
                  ? "var(--theme-interactive-accent)"
                  : "var(--theme-log-warning, #d97706)",
              color: "white",
            }}
            title={`Click to switch to ${group.combinator === "and" ? "OR" : "AND"}`}
          >
            {group.combinator === "and" ? "ALL" : "ANY"}
          </button>
          <span className="text-theme-text-tertiary">match</span>
        </div>
        <div className="flex items-center gap-0.5">
          {isSubGroup && (
            <button
              type="button"
              onClick={() => {
                if (showGroupComment) {
                  onChange({ ...group, comment: undefined });
                }
                setShowGroupComment(!showGroupComment);
              }}
              className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${
                showGroupComment || group.comment
                  ? "text-theme-interactive-accent hover:text-theme-interactive-accent-hover"
                  : "text-theme-text-tertiary hover:text-theme-text-secondary hover:bg-theme-bg-hover"
              }`}
              title={showGroupComment ? "Remove group comment" : "Add group comment"}
            >
              <MessageSquare className="h-3 w-3" />
            </button>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="h-6 w-6 flex items-center justify-center rounded text-theme-text-tertiary hover:text-theme-status-error-text hover:bg-theme-bg-hover transition-colors"
              title="Remove group"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Group comment (optional, sub-groups only) */}
      {isSubGroup && showGroupComment && (
        <div className="flex gap-1.5 items-center px-2.5 py-1 border-b border-theme-border-secondary bg-theme-surface-elevated/30">
          <span className="text-[10px] text-theme-text-tertiary font-mono select-none">#</span>
          <input
            type="text"
            value={group.comment || ""}
            onChange={(e) =>
              onChange({ ...group, comment: e.target.value || undefined })
            }
            placeholder="Describe this group..."
            className="flex-1 min-w-0 h-5 px-1.5 text-xs bg-transparent text-theme-text-secondary placeholder:text-theme-text-tertiary italic border-none outline-none"
          />
        </div>
      )}

      {/* Children */}
      <div className="p-2 space-y-1.5">
        {group.children.length === 0 ? (
          <div className="text-center py-3">
            {loading ? (
              <div className="flex items-center justify-center gap-1.5 text-xs text-theme-text-tertiary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading columns...
              </div>
            ) : !hasInput ? (
              <div className="text-xs text-theme-text-tertiary">
                Connect a data source to add filter conditions
              </div>
            ) : (
              <button
                type="button"
                onClick={addCondition}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border border-dashed border-theme-interactive-accent text-theme-interactive-accent hover:bg-theme-interactive-accent/10 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add a filter condition
              </button>
            )}
          </div>
        ) : (
          group.children.map((child, index) => (
            <div key={child.id} className={child.type === "group" && index > 0 ? "pt-1" : ""}>
              {index > 0 && (
                <div className={child.type === "group" ? "pb-0.5" : ""}>
                  <CombinatorBadge
                    combinator={group.combinator}
                    onClick={toggleCombinator}
                  />
                </div>
              )}
              {child.type === "condition" ? (
                <ConditionRow
                  condition={child}
                  columns={columns}
                  onChange={(updates) =>
                    updateCondition(child.id, updates)
                  }
                  onRemove={() => removeChild(child.id)}
                  canRemove={canRemoveChild}
                />
              ) : (
                <ConditionGroup
                  group={child}
                  columns={columns}
                  onChange={(updated) => updateChild(child.id, updated)}
                  onRemove={() => removeChild(child.id)}
                  depth={depth + 1}
                />
              )}
            </div>
          ))
        )}
      </div>

      {/* Add buttons - only when there are already children (empty state has its own CTA) */}
      {group.children.length > 0 && (
        <div className="flex items-center gap-3 px-2.5 pb-2 pt-1">
          <button
            type="button"
            onClick={addCondition}
            disabled={columns.length === 0}
            className="flex items-center gap-1 text-xs font-medium text-theme-interactive-accent hover:text-theme-interactive-accent-hover transition-colors py-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="h-3.5 w-3.5" />
            Add condition
          </button>
          {depth < MAX_DEPTH && (
            <button
              type="button"
              onClick={addGroup}
              disabled={columns.length === 0}
              className="flex items-center gap-1 text-xs font-medium text-theme-text-secondary hover:text-theme-text-primary transition-colors py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Layers className="h-3.5 w-3.5" />
              Add group
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// --- Main Component ---

interface FilterExpressionBuilderProps {
  group: FilterGroup;
  onGroupChange: (group: FilterGroup) => void;
  columns: ColumnSchema[];
  /** Whether an upstream data source is wired in */
  hasInput?: boolean;
  /** Whether upstream metadata is currently loading */
  loading?: boolean;
}

export function FilterExpressionBuilder({
  group,
  onGroupChange,
  columns,
  hasInput = false,
  loading = false,
}: FilterExpressionBuilderProps) {
  return (
    <div className="space-y-2">
      <ConditionGroup
        group={group}
        columns={columns}
        onChange={onGroupChange}
        depth={0}
        hasInput={hasInput}
        loading={loading}
      />
    </div>
  );
}
