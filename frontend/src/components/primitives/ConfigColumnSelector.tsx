import clsx from "clsx";
import React, {
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
} from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useMultiSelection } from "./hooks/useMultiSelection";
import { useListKeyboard } from "./hooks/useListKeyboard";

/**
 * Generic item type for ConfigColumnSelector.
 * Must have a unique identifier.
 */
export interface ColumnSelectorItem {
  id: string;
  [key: string]: unknown;
}

/**
 * Handlers passed to itemRenderer for each item
 */
export interface ColumnSelectorItemHandlers {
  /** Whether this item is selected */
  isSelected: boolean;
  /** Whether this item has keyboard focus */
  isFocused: boolean;
  /** Whether this item can be reordered */
  canReorder: boolean;
  /** The item's position in the reorderable section (1-based, or 0 if not reorderable) */
  position: number;
  /** Total count of reorderable items */
  totalReorderable: number;
}

/**
 * Props for the reorder buttons render function
 */
export interface ReorderButtonsProps {
  /** Move selection up */
  onMoveUp: () => void;
  /** Move selection down */
  onMoveDown: () => void;
  /** Whether move up is available */
  canMoveUp: boolean;
  /** Whether move down is available */
  canMoveDown: boolean;
  /** Whether the list is disabled */
  disabled: boolean;
}

export interface ConfigColumnSelectorProps<T extends ColumnSelectorItem> {
  /** Items to display in the list */
  items: readonly T[];
  /** Callback when items are reordered */
  onReorder: (items: T[]) => void;
  /** Get unique key for an item (defaults to item.id) */
  getItemKey?: (item: T) => string;
  /** Render function for each item row */
  itemRenderer: (item: T, handlers: ColumnSelectorItemHandlers) => ReactNode;
  /** Filter function: which items can be reordered */
  canReorderItem?: (item: T) => boolean;
  /** Callback when selection changes (receives selected items) */
  onSelectionChange?: (selectedItems: T[]) => void;
  /** Label for the list */
  label?: ReactNode;
  /** Description below the label */
  description?: ReactNode;
  /** Message shown when no items */
  emptyMessage?: string;
  /** Whether the list is disabled */
  disabled?: boolean;
  /** Additional class name for the container */
  className?: string;
  /** Show reorder buttons in UI */
  showReorderButtons?: boolean;
  /** Additional action buttons to render in the header next to reorder buttons */
  headerActions?: ReactNode;
  /** Render function to place reorder buttons externally (receives button handlers/state). Return value is rendered at component end. */
  renderReorderButtons?: (props: ReorderButtonsProps) => ReactNode;
  /** Accessible label for the list */
  ariaLabel?: string;
}

const defaultGetItemKey = <T extends ColumnSelectorItem>(item: T): string =>
  item.id;

/**
 * A primitive for selecting and reordering columns in a list.
 *
 * Features:
 * - Click to select single item
 * - Shift+click to select range
 * - Arrow Up/Down to reorder selected items
 * - Shift+Arrow to extend selection
 * - Visual indicators for selection and focus
 * - Optional reorder buttons
 *
 * This component is designed for configurations where:
 * - Items come from a schema (not user-created)
 * - A subset of items may be "active" and reorderable
 * - Per-item configuration is handled by the itemRenderer
 */
export function ConfigColumnSelector<T extends ColumnSelectorItem>({
  items,
  onReorder,
  getItemKey = defaultGetItemKey,
  itemRenderer,
  canReorderItem,
  onSelectionChange,
  label,
  description,
  emptyMessage = "No items available",
  disabled = false,
  className,
  showReorderButtons = true,  headerActions,  renderReorderButtons,
  ariaLabel,
}: ConfigColumnSelectorProps<T>): React.ReactElement {
  const fieldId = useId();
  const listRef = useRef<HTMLDivElement>(null);

  // Multi-selection state
  const {
    selectedKeys,
    isSelected,
    handleClick,
    selectKeys,
    selectedCount,
    getSelectedItems,
  } = useMultiSelection({
    getItemKey,
    items,
  });

  // Notify parent when selection changes
  useEffect(() => {
    if (onSelectionChange) {
      onSelectionChange(getSelectedItems());
    }
  }, [selectedKeys, onSelectionChange, getSelectedItems]);

  // Keyboard navigation and reordering
  const { focusedIndex, handleKeyDown, setFocusedIndex } = useListKeyboard({
    items,
    getItemKey,
    selectedKeys,
    onSelectionChange: selectKeys,
    onReorder: disabled ? undefined : onReorder,
    allowReorder: !disabled,
    canReorderItem,
  });

  // Count of reorderable items (for position display)
  const reorderableCount = useMemo(() => {
    if (!canReorderItem) {
      return items.length;
    }
    return items.filter(canReorderItem).length;
  }, [items, canReorderItem]);

  // Get position of item in reorderable section
  const getReorderPosition = useCallback(
    (item: T): number => {
      if (canReorderItem && !canReorderItem(item)) {
        return 0;
      }
      let position = 0;
      for (const i of items) {
        if (!canReorderItem || canReorderItem(i)) {
          position++;
          if (getItemKey(i) === getItemKey(item)) {
            return position;
          }
        }
      }
      return 0;
    },
    [items, canReorderItem, getItemKey]
  );

  // Handle item click
  const handleItemClick = useCallback(
    (item: T, event: React.MouseEvent) => {
      if (disabled) {
        return;
      }
      const index = items.findIndex((i) => getItemKey(i) === getItemKey(item));
      setFocusedIndex(index);
      handleClick(item, { shiftKey: event.shiftKey });
    },
    [disabled, items, getItemKey, setFocusedIndex, handleClick]
  );

  // Handle move up button
  const handleMoveUp = useCallback(() => {
    if (disabled || selectedCount === 0) {
      return;
    }
    // Simulate ArrowUp keypress
    const fakeEvent = {
      key: "ArrowUp",
      shiftKey: false,
      preventDefault: () => {},
    } as React.KeyboardEvent;
    handleKeyDown(fakeEvent);
  }, [disabled, selectedCount, handleKeyDown]);

  // Handle move down button
  const handleMoveDown = useCallback(() => {
    if (disabled || selectedCount === 0) {
      return;
    }
    // Simulate ArrowDown keypress
    const fakeEvent = {
      key: "ArrowDown",
      shiftKey: false,
      preventDefault: () => {},
    } as React.KeyboardEvent;
    handleKeyDown(fakeEvent);
  }, [disabled, selectedCount, handleKeyDown]);

  // Can move selection up/down?
  const canMoveUp = useMemo(() => {
    if (disabled || selectedCount === 0) {
      return false;
    }
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      return false;
    }
    // Check if first selected item is at index 0
    const firstSelected = selectedItems[0]!;
    const firstIndex = items.findIndex(
      (i) => getItemKey(i) === getItemKey(firstSelected)
    );
    if (firstIndex <= 0) {
      return false;
    }
    // Check if item above is reorderable
    if (canReorderItem) {
      const itemAbove = items[firstIndex - 1];
      if (itemAbove && !canReorderItem(itemAbove)) {
        return false;
      }
    }
    return true;
  }, [disabled, selectedCount, getSelectedItems, items, getItemKey, canReorderItem]);

  const canMoveDown = useMemo(() => {
    if (disabled || selectedCount === 0) {
      return false;
    }
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      return false;
    }
    // Check if last selected item is at end
    const lastSelected = selectedItems[selectedItems.length - 1]!;
    const lastIndex = items.findIndex(
      (i) => getItemKey(i) === getItemKey(lastSelected)
    );
    if (lastIndex >= items.length - 1) {
      return false;
    }
    // Check if item below is reorderable
    if (canReorderItem) {
      const itemBelow = items[lastIndex + 1];
      if (itemBelow && !canReorderItem(itemBelow)) {
        return false;
      }
    }
    return true;
  }, [disabled, selectedCount, getSelectedItems, items, getItemKey, canReorderItem]);

  // Render external reorder buttons if provided
  const externalButtons = renderReorderButtons?.({
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
    canMoveUp,
    canMoveDown,
    disabled,
  });

  // Focus the list when component mounts or gets focus
  const handleContainerFocus = useCallback(() => {
    if (focusedIndex === null && items.length > 0) {
      setFocusedIndex(0);
    }
  }, [focusedIndex, items.length, setFocusedIndex]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex !== null && listRef.current) {
      const focusedElement = listRef.current.querySelector(
        `[data-index="${focusedIndex}"]`
      );
      if (focusedElement && typeof focusedElement.scrollIntoView === "function") {
        focusedElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusedIndex]);

  return (
    <div className={clsx("flex flex-col", className)}>
      {/* Header */}
      {(label || headerActions || (showReorderButtons && reorderableCount > 0)) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-theme-border-primary bg-theme-surface-elevated">
          <div className="flex items-center gap-2">
            {label && (
              <span
                id={`${fieldId}-label`}
                className="text-sm font-semibold text-theme-text-primary"
              >
                {label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {headerActions}
            {showReorderButtons && reorderableCount > 1 && (
              <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleMoveUp}
                disabled={disabled || !canMoveUp}
                className={clsx(
                  "p-1 rounded border border-theme-border-primary",
                  "text-theme-text-secondary hover:text-theme-text-primary",
                  "hover:bg-theme-surface-hover transition-colors",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
                title="Move selection up (Arrow Up)"
                aria-label="Move selection up"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleMoveDown}
                disabled={disabled || !canMoveDown}
                className={clsx(
                  "p-1 rounded border border-theme-border-primary",
                  "text-theme-text-secondary hover:text-theme-text-primary",
                  "hover:bg-theme-surface-hover transition-colors",
                  "disabled:opacity-30 disabled:cursor-not-allowed"
                )}
                title="Move selection down (Arrow Down)"
                aria-label="Move selection down"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {description && (
        <div
          id={`${fieldId}-description`}
          className="px-4 py-2 text-xs border-b text-theme-text-tertiary border-theme-border-primary"
        >
          {description}
        </div>
      )}

      {/* List */}
      <div
        ref={listRef}
        role="listbox"
        aria-label={ariaLabel || (typeof label === "string" ? label : undefined)}
        aria-describedby={description ? `${fieldId}-description` : undefined}
        aria-multiselectable="true"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={disabled ? undefined : handleKeyDown}
        onFocus={handleContainerFocus}
        className={clsx(
          "flex-1 overflow-y-auto",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-theme-interactive-accent focus-visible:ring-inset",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {items.length === 0 ? (
          <div className="p-4 text-sm text-center text-theme-text-tertiary">
            {emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-theme-border-primary">
            {items.map((item, index) => {
              const key = getItemKey(item);
              const itemIsSelected = isSelected(item);
              const itemIsFocused = focusedIndex === index;
              const itemCanReorder = !canReorderItem || canReorderItem(item);
              const position = getReorderPosition(item);

              const handlers: ColumnSelectorItemHandlers = {
                isSelected: itemIsSelected,
                isFocused: itemIsFocused,
                canReorder: itemCanReorder,
                position,
                totalReorderable: reorderableCount,
              };

              return (
                <div
                  key={key}
                  data-index={index}
                  role="option"
                  aria-selected={itemIsSelected}
                  onClick={(e) => handleItemClick(item, e)}
                  style={{
                    backgroundColor: itemIsSelected ? 'var(--color-selection-highlight-bg)' : undefined,
                    borderLeft: itemIsSelected ? '3px solid var(--color-selection-highlight-border)' : '3px solid transparent',
                  }}
                  className={clsx(
                    "px-4 py-2 cursor-pointer transition-colors select-none",
                    !itemIsSelected && "hover:bg-theme-surface-hover",
                    // Focus ring
                    itemIsFocused &&
                      "ring-2 ring-inset ring-theme-interactive-accent/50",
                    // Disabled state
                    disabled && "pointer-events-none"
                  )}
                >
                  {itemRenderer(item, handlers)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      {!disabled && items.length > 0 && (
        <div className="px-4 py-1.5 text-[10px] text-theme-text-disabled border-t border-theme-border-primary bg-theme-surface-panel">
          <span>Click to select</span>
          <span className="mx-2">|</span>
          <span>Shift+Click for range</span>
          <span className="mx-2">|</span>
          <span>Arrow keys to reorder</span>
          <span className="mx-2">|</span>
          <span>Shift+Arrow to extend selection</span>
        </div>
      )}

      {/* External buttons slot - rendered via portal by consumer */}
      {externalButtons}
    </div>
  );
}
