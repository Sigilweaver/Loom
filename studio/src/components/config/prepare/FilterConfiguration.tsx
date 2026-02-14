import { useEffect, useMemo, useCallback } from "react";
import {
  ToolConfig,
  EmissionMap,
  Tool,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { CodeEditor } from "@components/common/CodeEditor";
import { Switch } from "@components/ui/Switch";
import { usePolarsFunctions } from "@api/hooks";
import { useToolConfiguration } from "@hooks/useToolConfiguration";
import { EXPRESSION_DOCS_URL } from "@data/tools";
import { CommonSockets } from "@domain/workflow/constants/socketIds";
import ExpressionAssist from "@components/ai/ExpressionAssist";
import FilterAssist from "@components/ai/FilterAssist";
import type { BasicFilterResult } from '../../../ai/agent';
import {
  FilterExpressionBuilder,
  generateGroupExpression,
  legacyToGroup,
  groupToLegacy,
  type FilterCondition,
  type FilterConditionItem,
  type FilterGroup,
  type FilterItem,
  type Combinator,
} from "./FilterExpressionBuilder";

// Default values for Filter tool (must match TOOL_DEFINITIONS)
const FILTER_DEFAULTS = {
  expression: "",
  mode: "Basic",
  conditions: [] as FilterCondition[],
  combinator: "and" as Combinator,
  conditionGroup: null as FilterGroup | null,
} as const;

/** Create an empty root group */
function emptyRootGroup(): FilterGroup {
  return {
    id: crypto.randomUUID(),
    type: "group",
    combinator: "and",
    children: [],
  };
}

/**
 * Ensure all conditions have IDs (handles legacy data without IDs).
 */
function normalizeConditions(raw: unknown): FilterCondition[] {
  if (!Array.isArray(raw)) return [];
  return (raw as FilterCondition[]).map((c) => ({
    ...c,
    id: c.id || crypto.randomUUID(),
  }));
}

/**
 * Resolve the FilterGroup from config, handling migration from legacy format.
 * Priority: conditionGroup > conditions[] + combinator > empty group
 */
function resolveConditionGroup(config: ToolConfig): FilterGroup {
  // New format: conditionGroup is stored directly
  if (config.conditionGroup && typeof config.conditionGroup === "object") {
    const group = config.conditionGroup as unknown as FilterGroup;
    if (group.type === "group" && Array.isArray(group.children)) {
      return group;
    }
  }
  // Legacy format: flat conditions[] + combinator
  const conditions = normalizeConditions(config.conditions);
  const combinator = (config.combinator as Combinator) || "and";
  if (conditions.length > 0) {
    return legacyToGroup(conditions, combinator);
  }
  // Empty
  return emptyRootGroup();
}

/**
 * Build the emission map for Filter tool config.
 * Preserves existing _emit entries and updates Filter-specific fields
 * based on whether they differ from defaults.
 */
function buildFilterEmit(config: ToolConfig): EmissionMap {
  const emit: EmissionMap = {
    ...((config._emit as EmissionMap | undefined) ?? {}),
  };

  const expression = (config.expression as string) ?? "";
  const mode = (config.mode as string) ?? FILTER_DEFAULTS.mode;

  if (expression !== FILTER_DEFAULTS.expression) {
    emit.expression = true;
  } else {
    delete emit.expression;
  }
  if (mode !== FILTER_DEFAULTS.mode) {
    emit.mode = true;
  } else {
    delete emit.mode;
  }

  // Track conditionGroup if it has children
  const group = config.conditionGroup as unknown as FilterGroup | null;
  if (group && group.children && group.children.length > 0) {
    emit.conditionGroup = true;
    emit.conditions = true;
    emit.combinator = true;
  } else {
    delete emit.conditionGroup;
    delete emit.conditions;
    delete emit.combinator;
  }

  return emit;
}

interface FilterConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

export function FilterConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: FilterConfigurationProps) {
  // Unified configuration hook - handles metadata, connections, emissions
  const { columns, hasInput, loading } = useToolConfiguration({
    toolId,
    socketId: CommonSockets.INPUT,
    tools,
    wires,
    workflowMeta,
    config,
    onChange,
  });

  // Polars functions for autocomplete
  const { functions, fetchFunctions } = usePolarsFunctions();
  useEffect(() => {
    if (!functions) fetchFunctions();
  }, [functions, fetchFunctions]);

  // Derive state from config
  const currentGroup = useMemo(
    () => resolveConditionGroup(config),
    [config]
  );
  const currentExpression = (config.expression as string) || "";

  // Auto-seed one condition when columns first become available and group is empty
  const isBasicMode = (config.mode as string | undefined) !== "Custom";
  useEffect(() => {
    if (
      isBasicMode &&
      columns.length > 0 &&
      currentGroup.children.length === 0
    ) {
      const seeded: FilterGroup = {
        ...currentGroup,
        children: [
          {
            id: crypto.randomUUID(),
            type: "condition",
            column: columns[0]!.name,
            operator: "eq",
            value: "",
          },
        ],
      };
      const expression = generateGroupExpression(seeded, columns);
      const { conditions, combinator } = groupToLegacy(seeded);
      const newConfig: ToolConfig = {
        ...config,
        conditionGroup: seeded as unknown as Record<string, unknown>,
        conditions: conditions as unknown as Record<string, unknown>[],
        combinator,
        expression,
      };
      newConfig._emit = buildFilterEmit(newConfig);
      onChange(newConfig);
    }
    // Only run when columns first become available, not on every config change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns.length, isBasicMode]);

  // Determine mode: backward compat - if no mode set but expression exists, use Custom
  const isAdvanced = useMemo(() => {
    const configMode = config.mode as string | undefined;
    if (configMode === "Custom") return true;
    if (configMode === "Basic") return false;
    // No mode set: if expression exists but no condition data, treat as Custom (legacy)
    if (
      currentExpression &&
      currentGroup.children.length === 0
    )
      return true;
    return false;
  }, [config.mode, currentExpression, currentGroup.children.length]);

  const handleModeToggle = useCallback(
    (advanced: boolean) => {
      const newMode = advanced ? "Custom" : "Basic";
      let expression = currentExpression;

      // When switching back to Basic, regenerate expression from group
      if (!advanced && currentGroup.children.length > 0) {
        expression = generateGroupExpression(currentGroup, columns);
      }

      const { conditions, combinator } = groupToLegacy(currentGroup);
      const newConfig: ToolConfig = {
        ...config,
        mode: newMode,
        expression,
        conditionGroup: currentGroup as unknown as Record<string, unknown>,
        conditions: conditions as unknown as Record<string, unknown>[],
        combinator,
      };
      newConfig._emit = buildFilterEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange, currentExpression, currentGroup, columns]
  );

  const handleGroupChange = useCallback(
    (newGroup: FilterGroup) => {
      const expression = generateGroupExpression(newGroup, columns);
      const { conditions, combinator } = groupToLegacy(newGroup);
      const newConfig: ToolConfig = {
        ...config,
        conditionGroup: newGroup as unknown as Record<string, unknown>,
        conditions: conditions as unknown as Record<string, unknown>[],
        combinator,
        expression,
      };
      newConfig._emit = buildFilterEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange, columns]
  );

  const handleExpressionChange = useCallback(
    (value: string) => {
      const newConfig: ToolConfig = {
        ...config,
        expression: value || "",
      };
      newConfig._emit = buildFilterEmit(newConfig);
      onChange(newConfig);
    },
    [config, onChange]
  );

  /**
   * Handle AI-generated basic filter conditions.
   * Converts BasicFilterResult into a FilterGroup and feeds it into handleGroupChange.
   */
  const handleAIFilterResult = useCallback(
    (result: BasicFilterResult) => {
      // Build children from flat conditions
      const children: FilterItem[] = (result.conditions ?? []).map((c): FilterConditionItem => ({
        id: crypto.randomUUID(),
        type: 'condition',
        column: c.column,
        operator: c.operator,
        value: c.value ?? '',
      }));

      // Build sub-groups
      if (result.groups) {
        for (const g of result.groups) {
          const subGroup: FilterGroup = {
            id: crypto.randomUUID(),
            type: 'group',
            combinator: (g.combinator as Combinator) || 'and',
            children: g.conditions.map((c): FilterConditionItem => ({
              id: crypto.randomUUID(),
              type: 'condition',
              column: c.column,
              operator: c.operator,
              value: c.value ?? '',
            })),
          };
          children.push(subGroup);
        }
      }

      const newGroup: FilterGroup = {
        id: crypto.randomUUID(),
        type: 'group',
        combinator: (result.combinator as Combinator) || 'and',
        children,
      };

      handleGroupChange(newGroup);
    },
    [handleGroupChange]
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Info Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-sm">
          <h3 className="font-semibold text-theme-text-primary mb-2">
            Filter Tool
          </h3>
          <p className="text-theme-text-secondary mb-2">
            Split data based on a condition. Rows matching the expression go to
            the True (T) output, others go to False (F).
          </p>
        </div>

        {/* Expression Section Header with Mode Toggle */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-theme-text-primary">
              Filter Expression
            </label>
            <Switch
              checked={isAdvanced}
              onCheckedChange={handleModeToggle}
              label="Advanced"
            />
          </div>

          {/* Basic Mode: Condition Group Builder + Expression Preview */}
          {!isAdvanced && (
            <>
              <FilterAssist
                columns={columns.map((c) => ({ name: c.name, dtype: c.dtype, nullable: c.nullable }))}
                onConditionsGenerated={handleAIFilterResult}
              />
              <FilterExpressionBuilder
                group={currentGroup}
                onGroupChange={handleGroupChange}
                columns={columns}
                hasInput={hasInput}
                loading={loading}
              />

              {/* Shaded Expression Preview */}
              <div className="space-y-1">
                <div className="text-[11px] text-theme-text-tertiary font-medium uppercase tracking-wider">
                  Expression Preview
                </div>
                <div className="border border-theme-border-secondary border-dashed rounded overflow-hidden opacity-80">
                  <CodeEditor
                    value={currentExpression}
                    onChange={() => {}}
                    language="python"
                    readOnly
                    height="80px"
                    placeholder="Add conditions above to generate an expression"
                  />
                </div>
              </div>
            </>
          )}

          {/* Advanced Mode: Full Editable CodeEditor */}
          {isAdvanced && (
            <>
              <div className="border border-theme-border rounded overflow-hidden">
                <CodeEditor
                  value={currentExpression}
                  onChange={handleExpressionChange}
                  language="python"
                  height="200px"
                  placeholder="pl.col('age') > 18"
                  columns={columns}
                  polarsFunctions={functions}
                  docsUrl={EXPRESSION_DOCS_URL}
                />
              </div>
              <ExpressionAssist
                columns={columns.map((c) => ({ name: c.name, dtype: c.dtype, nullable: c.nullable }))}
                toolType="Filter"
                onExpressionGenerated={handleExpressionChange}
                polarsFunctions={functions?.table_level?.map((f) => f.name)}
              />
              <p className="text-xs text-theme-text-tertiary">
                Write a Polars expression that returns True/False for each row
              </p>
            </>
          )}
        </div>

        {/* Examples Section - Advanced mode only */}
        {isAdvanced && (
          <div className="p-3 bg-theme-surface-elevated rounded text-xs space-y-3">
            <h4 className="font-semibold text-theme-text-primary mb-2">
              Example Expressions:
            </h4>

            <div className="space-y-2">
              <div>
                <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                  pl.col('age') &gt; 30
                </div>
                <div className="text-theme-text-tertiary">
                  Filter rows where age is greater than 30
                </div>
              </div>

              <div>
                <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                  pl.col('status') == 'active'
                </div>
                <div className="text-theme-text-tertiary">
                  Filter rows where status equals 'active'
                </div>
              </div>

              <div>
                <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                  (pl.col('a') &gt; 10) &amp; (pl.col('b') &lt; 20)
                </div>
                <div className="text-theme-text-tertiary">
                  Multiple conditions with AND
                </div>
              </div>

              <div>
                <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                  pl.col('name').str.contains('test')
                </div>
                <div className="text-theme-text-tertiary">
                  Filter rows where name contains 'test'
                </div>
              </div>

              <div>
                <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                  pl.col('value').is_not_null()
                </div>
                <div className="text-theme-text-tertiary">
                  Filter out null values
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Output Sockets Info */}
        <div className="p-3 bg-theme-surface-elevated rounded text-xs">
          <h4 className="font-semibold text-theme-text-primary mb-2">
            Output Sockets:
          </h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono bg-theme-surface-panel px-2 py-0.5 rounded text-theme-log-success">
                T
              </span>
              <span className="text-theme-text-secondary">
                Rows where expression is True
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-theme-surface-panel px-2 py-0.5 rounded text-theme-status-error-text">
                F
              </span>
              <span className="text-theme-text-secondary">
                Rows where expression is False
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
