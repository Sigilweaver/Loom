import { EmissionMap } from "@domain/workflow/entities/workflow";
import clsx from "clsx";
import React, { ReactNode, useCallback, useId, useMemo, useState } from "react";
import { ConfigField } from "./ConfigField";
import { ConfigValidationMessage } from "./ConfigValidationMessage";
import { usePrimitiveEmission } from "./hooks";

export interface ColumnOperation {
  id: string;
  field: string;
  operation: string;
  outputName: string;
  [key: string]: unknown; // Allow additional fields
}

export interface ItemHandlers<T = ColumnOperation> {
  update: (field: keyof T, value: unknown) => void;
  remove: () => void;
  moveUp: () => void;
  moveDown: () => void;
}

export interface ConfigColumnListProps {
  value: ColumnOperation[] | undefined;
  onChange: (
    value: ColumnOperation[] | undefined,
    emitPatch: EmissionMap,
    shouldEmit: boolean
  ) => void;
  configKey: string;
  label?: ReactNode;
  description?: ReactNode;
  inlineMessage?: ReactNode;
  defaultValue?: ColumnOperation[];
  disabled?: boolean;
  required?: boolean;
  minItems?: number;
  maxItems?: number;
  itemRenderer: (
    item: ColumnOperation,
    index: number,
    handlers: ItemHandlers
  ) => ReactNode;
  allowReorder?: boolean;
  addButtonLabel?: string;
  emptyMessage?: string;
  createNewItem: () => ColumnOperation;
  className?: string;
  customValidator?: (items: ColumnOperation[]) => string | null;
}

const EMPTY_ARRAY: readonly ColumnOperation[] = Object.freeze([]);

const generateId = (() => {
  let counter = 0;
  return () => `col-op-${Date.now()}-${counter++}`;
})();

const normalizeItems = (
  items: ColumnOperation[] | undefined
): ColumnOperation[] | undefined => {
  if (!Array.isArray(items) || items.length === 0) {
    return undefined;
  }
  // Ensure all items have IDs
  return items.map((item) => (item.id ? item : { ...item, id: generateId() }));
};

export const ConfigColumnList: React.FC<ConfigColumnListProps> = ({
  value,
  onChange,
  configKey,
  label = "Column Operations",
  description,
  inlineMessage,
  defaultValue = EMPTY_ARRAY as ColumnOperation[],
  disabled = false,
  required = false,
  minItems = 0,
  maxItems,
  itemRenderer,
  allowReorder = true,
  addButtonLabel = "+ Add Operation",
  emptyMessage = "No operations added yet",
  createNewItem,
  className,
  customValidator,
}) => {
  const fieldId = useId();
  const descriptionId = description ? `${fieldId}-description` : undefined;
  const messageId = `${fieldId}-validation`;

  const normalizedValue = useMemo(() => normalizeItems(value), [value]);
  const resolvedDefault = useMemo(
    () =>
      Array.isArray(defaultValue) && defaultValue.length > 0
        ? defaultValue
        : ([] as ColumnOperation[]),
    [defaultValue]
  );

  const { shouldEmit, commit } = usePrimitiveEmission<ColumnOperation[]>({
    configKey,
    value: normalizedValue,
    defaultValue: resolvedDefault,
    onChange,
  });

  const [items, setItems] = useState<ColumnOperation[]>(() => {
    return normalizedValue ?? [];
  });

  // Sync internal state when value changes externally
  useMemo(() => {
    const current = normalizedValue ?? [];
    if (
      current.length !== items.length ||
      current.some((item, i) => {
        const internalItem = items[i];
        if (!internalItem) return true;
        return item.id !== internalItem.id;
      })
    ) {
      setItems(current);
    }
  }, [normalizedValue, items]);

  const validateItems = useCallback(
    (currentItems: ColumnOperation[]): string | null => {
      if (required && currentItems.length === 0) {
        return "At least one operation is required.";
      }

      if (minItems > 0 && currentItems.length < minItems) {
        return `At least ${minItems} operation${minItems === 1 ? "" : "s"} required.`;
      }

      if (maxItems && currentItems.length > maxItems) {
        return `At most ${maxItems} operation${maxItems === 1 ? "" : "s"} allowed.`;
      }

      if (customValidator) {
        const message = customValidator(currentItems);
        if (message) {
          return message;
        }
      }

      return null;
    },
    [required, minItems, maxItems, customValidator]
  );

  const validationMessage = useMemo(
    () => validateItems(items),
    [items, validateItems]
  );

  const commitItems = useCallback(
    (newItems: ColumnOperation[]) => {
      setItems(newItems);
      const error = validateItems(newItems);
      if (error) {
        // Don't commit invalid state
        return;
      }
      commit(newItems.length > 0 ? newItems : undefined);
    },
    [validateItems, commit]
  );

  const handleAddItem = useCallback(() => {
    if (disabled) return;
    if (maxItems && items.length >= maxItems) return;

    const newItem = createNewItem();
    // Ensure ID is set
    if (!newItem.id) {
      newItem.id = generateId();
    }
    commitItems([...items, newItem]);
  }, [items, disabled, maxItems, createNewItem, commitItems]);

  const handleRemoveItem = useCallback(
    (id: string) => {
      if (disabled) return;
      const filtered = items.filter((item) => item.id !== id);
      commitItems(filtered);
    },
    [items, disabled, commitItems]
  );

  const handleUpdateItem = useCallback(
    (id: string, field: keyof ColumnOperation, newValue: unknown) => {
      if (disabled) return;
      const updated = items.map((item) =>
        item.id === id ? { ...item, [field]: newValue } : item
      );
      commitItems(updated);
    },
    [items, disabled, commitItems]
  );

  const handleMoveItem = useCallback(
    (id: string, direction: "up" | "down") => {
      if (!allowReorder || disabled) return;

      const index = items.findIndex((item) => item.id === id);
      if (index === -1) return;

      const newIndex = direction === "up" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= items.length) return;

      const newItems = [...items];
      const [removed] = newItems.splice(index, 1);
      if (removed) {
        newItems.splice(newIndex, 0, removed);
        commitItems(newItems);
      }
    },
    [items, allowReorder, disabled, commitItems]
  );

  const handleClearAll = useCallback(() => {
    if (disabled) return;
    commitItems([]);
  }, [disabled, commitItems]);

  const handleDragStart = useCallback((e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (allowReorder && !disabled) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }
    },
    [allowReorder, disabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, dropIndex: number) => {
      if (!allowReorder || disabled) return;

      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10);
      if (isNaN(fromIndex) || fromIndex === dropIndex) return;

      const newItems = [...items];
      const [removed] = newItems.splice(fromIndex, 1);
      if (removed) {
        newItems.splice(dropIndex, 0, removed);
        commitItems(newItems);
      }
    },
    [items, allowReorder, disabled, commitItems]
  );

  const canAddMore = !maxItems || items.length < maxItems;
  const canRemove = !required || items.length > minItems;

  const describedBy = useMemo(() => {
    const ids: string[] = [];
    if (descriptionId) {
      ids.push(descriptionId);
    }
    if (validationMessage) {
      ids.push(messageId);
    }
    return ids.length > 0 ? ids.join(" ") : undefined;
  }, [descriptionId, validationMessage, messageId]);

  return (
    <ConfigField
      label={label}
      labelFor={fieldId}
      description={description}
      descriptionId={descriptionId}
      inlineMessage={inlineMessage}
      willEmit={shouldEmit}
      required={required}
      className={className}
      contentClassName="space-y-3"
    >
      <div className="space-y-2">
        {items.length > 0 ? (
          <div className="space-y-2" aria-describedby={describedBy}>
            {items.map((item, index) => {
              const handlers: ItemHandlers = {
                update: (field, value) =>
                  handleUpdateItem(
                    item.id,
                    field as keyof ColumnOperation,
                    value
                  ),
                remove: () => handleRemoveItem(item.id),
                moveUp: () => handleMoveItem(item.id, "up"),
                moveDown: () => handleMoveItem(item.id, "down"),
              };

              return (
                <div
                  key={item.id}
                  className={clsx(
                    "border rounded border-theme-border-primary",
                    "bg-theme-surface-elevated p-3",
                    allowReorder && !disabled && "cursor-move"
                  )}
                  draggable={allowReorder && !disabled}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                >
                  <div className="flex items-start gap-2">
                    {allowReorder && !disabled && (
                      <div className="flex flex-col gap-1 pt-1">
                        <button
                          type="button"
                          onClick={() => handleMoveItem(item.id, "up")}
                          disabled={disabled || index === 0}
                          aria-label="Move up"
                          className={clsx(
                            "w-6 h-6 flex items-center justify-center text-xs rounded",
                            "border border-theme-border-primary",
                            "text-theme-text-secondary hover:bg-theme-surface-hover",
                            "disabled:opacity-30 disabled:cursor-not-allowed"
                          )}
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveItem(item.id, "down")}
                          disabled={disabled || index === items.length - 1}
                          aria-label="Move down"
                          className={clsx(
                            "w-6 h-6 flex items-center justify-center text-xs rounded",
                            "border border-theme-border-primary",
                            "text-theme-text-secondary hover:bg-theme-surface-hover",
                            "disabled:opacity-30 disabled:cursor-not-allowed"
                          )}
                        >
                          ▼
                        </button>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      {itemRenderer(item, index, handlers)}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={disabled || !canRemove}
                      aria-label={`Remove operation ${index + 1}`}
                      className={clsx(
                        "w-8 h-8 flex items-center justify-center text-sm rounded",
                        "border border-theme-border-primary",
                        "text-theme-text-secondary hover:text-theme-status-error",
                        "hover:bg-theme-surface-hover transition-colors",
                        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-theme-text-secondary"
                      )}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-sm text-center text-theme-text-tertiary border border-dashed rounded border-theme-border-primary">
            {emptyMessage}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleAddItem}
            disabled={disabled || !canAddMore}
            className={clsx(
              "px-3 py-1.5 text-sm font-medium rounded",
              "border border-theme-border-primary",
              "bg-theme-surface-panel text-theme-text-primary",
              "hover:bg-theme-surface-elevated transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {addButtonLabel}
          </button>
          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              disabled={disabled || !canRemove}
              className={clsx(
                "px-3 py-1.5 text-sm rounded",
                "border border-theme-border-primary",
                "text-theme-text-secondary hover:text-theme-status-error",
                "hover:bg-theme-surface-hover transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              Clear All
            </button>
          )}
        </div>

        {maxItems && (
          <div className="text-xs text-theme-text-tertiary">
            {items.length} / {maxItems} operations
          </div>
        )}
      </div>

      <ConfigValidationMessage
        id={messageId}
        state={validationMessage ? "error" : "info"}
        message={validationMessage}
      />
    </ConfigField>
  );
};
