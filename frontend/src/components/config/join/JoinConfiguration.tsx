import { useCallback, useEffect, useState } from "react";
import {
  ToolConfig,
  Tool,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";
import { useMultiSocketConfiguration } from "@hooks/useToolConfiguration";
import { filterCompatibleColumns } from "@domain/workflow/services/typeCompatibility";
import { JoinSockets } from "@domain/workflow/constants/socketIds";
import clsx from "clsx";

interface JoinConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

/**
 * Parse key arrays from config
 */
function parseKeys(config: ToolConfig, key: "leftKeys" | "rightKeys"): string[] {
  const keys = config[key];
  if (!Array.isArray(keys)) return [];
  return keys.filter((k): k is string => typeof k === "string");
}

export function JoinConfiguration({
  config,
  onChange,
  toolId,
  tools,
  wires,
  workflowMeta,
}: JoinConfigurationProps) {
  // Multi-socket configuration hook for left and right inputs
  const socketMetadata = useMultiSocketConfiguration({
    toolId,
    sockets: [
      { id: JoinSockets.INPUT_LEFT, name: "left" },
      { id: JoinSockets.INPUT_RIGHT, name: "right" },
    ],
    tools,
    wires,
    workflowMeta,
  });

  const leftColumns = socketMetadata.left?.columns ?? [];
  const rightColumns = socketMetadata.right?.columns ?? [];
  const leftLoading = socketMetadata.left?.loading ?? false;
  const rightLoading = socketMetadata.right?.loading ?? false;
  const hasLeftInput = socketMetadata.left?.hasInput ?? false;
  const hasRightInput = socketMetadata.right?.hasInput ?? false;

  // Local state for suffix editing
  const [localRightSuffix, setLocalRightSuffix] = useState<string>(
    (config.rightSuffix as string) || "_right"
  );

  // Get current keys from config
  const leftKeys = parseKeys(config, "leftKeys");
  const rightKeys = parseKeys(config, "rightKeys");

  // Update keys
  const updateKeys = useCallback(
    (side: "left" | "right", index: number, value: string) => {
      const keyName = side === "left" ? "leftKeys" : "rightKeys";
      const currentKeys = parseKeys(config, keyName);

      let newKeys: string[];
      if (value === "") {
        // Remove this key pair
        newKeys = currentKeys.filter((_, i) => i !== index);
      } else {
        newKeys = [...currentKeys];
        newKeys[index] = value;
      }

      const newConfig = {
        ...config,
        [keyName]: newKeys,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          [keyName]: true,
        },
      } as ToolConfig;
      onChange(newConfig);
    },
    [config, onChange]
  );

  // Remove a key pair
  const removeKeyPair = useCallback(
    (index: number) => {
      const newLeftKeys = leftKeys.filter((_, i) => i !== index);
      const newRightKeys = rightKeys.filter((_, i) => i !== index);

      const newConfig = {
        ...config,
        leftKeys: newLeftKeys,
        rightKeys: newRightKeys,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          leftKeys: true,
          rightKeys: true,
        },
      } as ToolConfig;
      onChange(newConfig);
    },
    [config, onChange, leftKeys, rightKeys]
  );

  // Update suffix
  const updateSuffix = useCallback(
    (value: string) => {
      const newConfig = {
        ...config,
        rightSuffix: value,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          rightSuffix: value !== "_right",
        },
      } as ToolConfig;
      onChange(newConfig);
    },
    [config, onChange]
  );

  // Sync local suffix with config
  useEffect(() => {
    setLocalRightSuffix((config.rightSuffix as string) || "_right");
  }, [config.rightSuffix]);

  // Determine rows to show: all populated pairs + one blank row for new entries
  // A row is "complete" when both left and right are populated
  const populatedPairCount = Math.max(leftKeys.length, rightKeys.length);
  const keyPairCount = populatedPairCount + 1; // Always show one blank row at the end

  // Determine if this is a cross join (no keys selected with both inputs connected)
  const hasValidKeys = leftKeys.length > 0 && rightKeys.length > 0 && 
    leftKeys.every(k => k) && rightKeys.every(k => k);
  const isCrossJoin = hasLeftInput && hasRightInput && !hasValidKeys;

  // Auto-set joinType based on whether keys are selected
  // Extract primitive values to avoid infinite loops from config object reference changes
  const currentJoinType = config.joinType as string | undefined;
  useEffect(() => {
    if (!hasLeftInput || !hasRightInput) return;
    
    const targetJoinType = hasValidKeys ? "inner" : "cross";
    
    // Only update if the joinType actually needs to change
    if (currentJoinType !== targetJoinType) {
      onChange({
        ...config,
        joinType: targetJoinType,
        _emit: {
          ...(config._emit as Record<string, boolean> | undefined),
          joinType: true,
        },
      });
    }
  }, [hasLeftInput, hasRightInput, hasValidKeys, currentJoinType]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Info Section */}
        <div className="p-3 text-sm rounded bg-theme-surface-elevated">
          <h3 className="mb-2 font-semibold text-theme-text-primary">
            Join Tool
          </h3>
          <p className="mb-2 text-theme-text-secondary">
            Combines two datasets on matching key columns.
          </p>
          <p className="text-xs text-theme-text-tertiary">
            Outputs: Unmatched Left (L), Matched (J), Unmatched Right (R)
          </p>
        </div>

        {/* Connection Status */}
        {(!hasLeftInput || !hasRightInput) && (
          <div className="p-3 text-sm border rounded bg-amber-500/10 border-amber-500/30">
            <p className="text-amber-500">
              {!hasLeftInput && !hasRightInput
                ? "Connect both inputs to configure join keys."
                : !hasLeftInput
                ? "Connect the Left (L) input to configure join keys."
                : "Connect the Right (R) input to configure join keys."}
            </p>
          </div>
        )}

        {/* Key Pairs Section */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-theme-text-primary">
            Join Keys
          </h4>

          {/* Column Headers */}
          {(hasLeftInput || hasRightInput) && (
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs text-theme-text-tertiary">
              <div>Left Column</div>
              <div>Right Column</div>
              <div className="w-6"></div>
            </div>
          )}

          {/* Key Pair Rows */}
          {Array.from({ length: keyPairCount }).map((_, index) => {
            // Get the dtype of the selected left column for this row
            const selectedLeftKey = leftKeys[index];
            const selectedLeftColumn = leftColumns.find(
              (col) => col.name === selectedLeftKey
            );
            const leftDtype = selectedLeftColumn?.dtype;

            // Filter right columns to only show compatible types
            const compatibleRightColumns = filterCompatibleColumns(
              rightColumns,
              leftDtype
            );

            // Check if current right selection is now incompatible
            const currentRightKey = rightKeys[index];
            const isRightSelectionIncompatible =
              currentRightKey &&
              leftDtype &&
              !compatibleRightColumns.some((col) => col.name === currentRightKey);

            return (
              <div
                key={index}
                className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center"
              >
                {/* Left Key Dropdown */}
                <select
                  value={leftKeys[index] || ""}
                  onChange={(e) => updateKeys("left", index, e.target.value)}
                  disabled={!hasLeftInput}
                  className={clsx(
                    "w-full px-2 py-1.5 text-sm rounded border",
                    "bg-theme-surface-elevated border-theme-border-primary",
                    "text-theme-text-primary",
                    "focus:outline-none focus:ring-1 focus:ring-theme-accent",
                    !hasLeftInput && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <option value="">Select column...</option>
                  {leftColumns.map((col) => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.dtype})
                    </option>
                  ))}
                </select>

                {/* Right Key Dropdown - filtered by left column type */}
                <select
                  value={isRightSelectionIncompatible ? "" : (rightKeys[index] || "")}
                  onChange={(e) => updateKeys("right", index, e.target.value)}
                  disabled={!hasRightInput}
                  className={clsx(
                    "w-full px-2 py-1.5 text-sm rounded border",
                    "bg-theme-surface-elevated border-theme-border-primary",
                    "text-theme-text-primary",
                    "focus:outline-none focus:ring-1 focus:ring-theme-accent",
                    !hasRightInput && "opacity-50 cursor-not-allowed",
                    isRightSelectionIncompatible && "border-red-500"
                  )}
                >
                  <option value="">
                    {leftDtype
                      ? `Select compatible column...`
                      : "Select column..."}
                  </option>
                  {compatibleRightColumns.map((col) => (
                    <option key={col.name} value={col.name}>
                      {col.name} ({col.dtype})
                    </option>
                  ))}
                  {/* Show incompatible selection with warning if exists */}
                  {isRightSelectionIncompatible && (
                    <option value={currentRightKey} disabled>
                      {currentRightKey} (incompatible type)
                    </option>
                  )}
                </select>

                {/* Remove Button - only show for populated rows */}
                {leftKeys[index] || rightKeys[index] ? (
                  <button
                    onClick={() => removeKeyPair(index)}
                    className="flex items-center justify-center w-6 h-6 text-sm text-red-500 rounded hover:bg-red-500/10"
                    title="Remove key pair"
                  >
                    x
                  </button>
                ) : (
                  <div className="w-6 h-6" /> // Empty spacer for blank row
                )}
              </div>
            );
          })}

          {/* Loading indicator */}
          {(leftLoading || rightLoading) && (
            <div className="text-xs text-theme-text-tertiary">
              Loading column metadata...
            </div>
          )}
        </div>

        {/* Suffix Configuration */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-theme-text-primary">
            Right Column Suffix
          </label>
          <p className="text-xs text-theme-text-tertiary">
            Added to right-side columns when names conflict with left.
          </p>
          <input
            type="text"
            value={localRightSuffix}
            onChange={(e) => setLocalRightSuffix(e.target.value)}
            onBlur={() => updateSuffix(localRightSuffix)}
            placeholder="_right"
            className={clsx(
              "w-full px-3 py-2 text-sm rounded border",
              "bg-theme-surface-elevated border-theme-border-primary",
              "text-theme-text-primary placeholder-theme-text-disabled",
              "focus:outline-none focus:ring-1 focus:ring-theme-accent"
            )}
          />
        </div>

        {/* Key Validation Warning */}
        {leftKeys.length !== rightKeys.length && leftKeys.length > 0 && (
          <div className="p-3 text-sm border rounded bg-red-500/10 border-red-500/30">
            <p className="text-red-500">
              Left and right key columns must have the same count.
            </p>
          </div>
        )}

        {/* Empty Keys Warning */}
        {leftKeys.some((k) => !k) || rightKeys.some((k) => !k) ? (
          <div className="p-3 text-sm border rounded bg-amber-500/10 border-amber-500/30">
            <p className="text-amber-500">
              Select columns for all key pairs.
            </p>
          </div>
        ) : null}

        {/* Cross Join Info Banner */}
        {isCrossJoin && (
          <div className="p-3 text-sm border rounded bg-blue-500/10 border-blue-500/30">
            <p className="font-medium text-blue-500 mb-1">
              Cross Join Mode
            </p>
            <p className="text-blue-400 text-xs">
              No join keys selected. This will produce a Cartesian product of both datasets 
              (every row from left combined with every row from right).
            </p>
            <p className="text-blue-400 text-xs mt-1">
              Select matching columns above to perform a standard join instead.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
