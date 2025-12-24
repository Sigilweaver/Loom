import { useCallback, useState } from "react";

export interface UseListKeyboardOptions<T> {
  /** All items in the list */
  items: readonly T[];
  /** Function to get a unique key from an item */
  getItemKey: (item: T) => string;
  /** Currently selected keys */
  selectedKeys: ReadonlySet<string>;
  /** Callback when selection should change (for shift+arrow) */
  onSelectionChange?: ((keys: ReadonlySet<string>) => void) | undefined;
  /** Callback when items should be reordered (for arrow without shift) */
  onReorder?: ((newItems: T[]) => void) | undefined;
  /** Whether reordering is enabled */
  allowReorder?: boolean | undefined;
  /** Filter function to determine which items can be reordered */
  canReorderItem?: ((item: T) => boolean) | undefined;
}

export interface UseListKeyboardResult {
  /** Index of the focused item (for visual highlight) */
  focusedIndex: number | null;
  /** Handle keyboard events on the list container */
  handleKeyDown: (event: React.KeyboardEvent) => void;
  /** Set focus to a specific index */
  setFocusedIndex: (index: number | null) => void;
  /** Move focus up */
  moveFocusUp: () => void;
  /** Move focus down */
  moveFocusDown: () => void;
}

/**
 * Hook for keyboard navigation and reordering in a list.
 *
 * Behavior:
 * - Arrow Up/Down without Shift: Move selected items up/down in the list
 * - Arrow Up/Down with Shift: Extend selection in that direction
 * - Home/End: Move focus to first/last item
 */
export function useListKeyboard<T>({
  items,
  getItemKey,
  selectedKeys,
  onSelectionChange,
  onReorder,
  allowReorder = true,
  canReorderItem,
}: UseListKeyboardOptions<T>): UseListKeyboardResult {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const moveFocusUp = useCallback(() => {
    setFocusedIndex((current) => {
      if (current === null || current <= 0) {
        return 0;
      }
      return current - 1;
    });
  }, []);

  const moveFocusDown = useCallback(() => {
    setFocusedIndex((current) => {
      if (current === null) {
        return 0;
      }
      if (current >= items.length - 1) {
        return items.length - 1;
      }
      return current + 1;
    });
  }, [items.length]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (items.length === 0) {
        return;
      }

      const isArrowUp = event.key === "ArrowUp";
      const isArrowDown = event.key === "ArrowDown";
      const isHome = event.key === "Home";
      const isEnd = event.key === "End";

      if (!isArrowUp && !isArrowDown && !isHome && !isEnd) {
        return;
      }

      event.preventDefault();

      // Home/End: just move focus
      if (isHome) {
        setFocusedIndex(0);
        return;
      }
      if (isEnd) {
        setFocusedIndex(items.length - 1);
        return;
      }

      if (event.shiftKey) {
        // Shift+Arrow: extend selection
        if (!onSelectionChange) {
          return;
        }

        // Find the current focus or first selected item
        let anchorIndex = focusedIndex;
        if (anchorIndex === null) {
          // Find first selected item
          anchorIndex = items.findIndex((item) =>
            selectedKeys.has(getItemKey(item))
          );
          if (anchorIndex < 0) {
            anchorIndex = 0;
          }
        }

        // Calculate new focus position
        const newFocusIndex = isArrowUp
          ? Math.max(0, anchorIndex - 1)
          : Math.min(items.length - 1, anchorIndex + 1);

        setFocusedIndex(newFocusIndex);

        // Build new selection: from first selected to new focus
        const selectedIndices = items
          .map((item, idx) => (selectedKeys.has(getItemKey(item)) ? idx : -1))
          .filter((idx) => idx >= 0);

        if (selectedIndices.length === 0) {
          // No selection, just select the focused item
          const focusedItem = items[newFocusIndex];
          if (focusedItem !== undefined) {
            onSelectionChange(new Set([getItemKey(focusedItem)]));
          }
        } else {
          // Extend from min selected to new focus, or from max selected to new focus
          const minSelected = Math.min(...selectedIndices);
          const maxSelected = Math.max(...selectedIndices);
          
          let start: number;
          let end: number;
          
          if (isArrowUp) {
            // Extending up: keep the bottom of selection, extend top
            start = Math.min(minSelected, newFocusIndex);
            end = maxSelected;
          } else {
            // Extending down: keep the top of selection, extend bottom
            start = minSelected;
            end = Math.max(maxSelected, newFocusIndex);
          }
          
          const newKeys = new Set<string>();
          for (let i = start; i <= end; i++) {
            const item = items[i];
            if (item !== undefined) {
              newKeys.add(getItemKey(item));
            }
          }
          onSelectionChange(newKeys);
        }
      } else {
        // Arrow without Shift: reorder selected items
        if (!allowReorder || !onReorder || selectedKeys.size === 0) {
          // Just move focus if reordering not available
          if (isArrowUp) {
            moveFocusUp();
          } else {
            moveFocusDown();
          }
          return;
        }

        // Get indices of selected items that can be reordered
        const selectedIndices: number[] = [];
        items.forEach((item, idx) => {
          if (selectedKeys.has(getItemKey(item))) {
            if (!canReorderItem || canReorderItem(item)) {
              selectedIndices.push(idx);
            }
          }
        });

        if (selectedIndices.length === 0) {
          return;
        }

        // Sort indices for consistent behavior
        selectedIndices.sort((a, b) => a - b);

        const direction = isArrowUp ? -1 : 1;
        const firstIdx = selectedIndices[0]!;
        const lastIdx = selectedIndices[selectedIndices.length - 1]!;

        // Check if we can move in the desired direction
        if (isArrowUp && firstIdx === 0) {
          return; // Can't move up, already at top
        }
        if (isArrowDown && lastIdx === items.length - 1) {
          return; // Can't move down, already at bottom
        }

        // Also check if the item we'd swap with is reorderable
        const swapIdx = isArrowUp ? firstIdx - 1 : lastIdx + 1;
        const swapItem = items[swapIdx];
        if (swapItem !== undefined && canReorderItem && !canReorderItem(swapItem)) {
          return; // Can't swap with non-reorderable item
        }

        // Create new array with items moved
        const newItems = [...items];
        
        if (isArrowUp) {
          // Moving up: swap each selected item with the one above it, starting from top
          for (const idx of selectedIndices) {
            const targetIdx = idx + direction;
            if (targetIdx >= 0) {
              const temp = newItems[targetIdx]!;
              newItems[targetIdx] = newItems[idx]!;
              newItems[idx] = temp;
            }
          }
        } else {
          // Moving down: swap each selected item with the one below it, starting from bottom
          for (let i = selectedIndices.length - 1; i >= 0; i--) {
            const idx = selectedIndices[i]!;
            const targetIdx = idx + direction;
            if (targetIdx < newItems.length) {
              const temp = newItems[targetIdx]!;
              newItems[targetIdx] = newItems[idx]!;
              newItems[idx] = temp;
            }
          }
        }

        // Update focus to follow selection
        if (focusedIndex !== null) {
          setFocusedIndex(focusedIndex + direction);
        }

        onReorder(newItems);
      }
    },
    [
      items,
      getItemKey,
      selectedKeys,
      onSelectionChange,
      onReorder,
      allowReorder,
      canReorderItem,
      focusedIndex,
      moveFocusUp,
      moveFocusDown,
    ]
  );

  return {
    focusedIndex,
    handleKeyDown,
    setFocusedIndex,
    moveFocusUp,
    moveFocusDown,
  };
}
