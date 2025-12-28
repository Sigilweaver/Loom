import { useCallback, useState } from "react";

export interface UseMultiSelectionOptions<T> {
  /** Function to get a unique key from an item */
  getItemKey: (item: T) => string;
  /** All items in the list (for shift-click range selection) */
  items: readonly T[];
}

export interface UseMultiSelectionResult<T> {
  /** Currently selected item keys */
  selectedKeys: ReadonlySet<string>;
  /** The anchor item key for shift-click range selection */
  anchorKey: string | null;
  /** Check if an item is selected */
  isSelected: (item: T) => boolean;
  /** Handle click on an item (supports shift for range select) */
  handleClick: (item: T, event: { shiftKey: boolean }) => void;
  /** Select a single item (clears other selection) */
  selectSingle: (item: T) => void;
  /** Select multiple items by key */
  selectKeys: (keys: Iterable<string>) => void;
  /** Clear all selection */
  clearSelection: () => void;
  /** Select all items */
  selectAll: () => void;
  /** Get selected items in order they appear in items array */
  getSelectedItems: () => T[];
  /** Number of selected items */
  selectedCount: number;
}

/**
 * Hook for managing multi-selection in a list with shift-click range selection.
 *
 * Behavior:
 * - Click: Select single item, clear others, set anchor
 * - Shift+Click: Select range from anchor to clicked item
 */
export function useMultiSelection<T>({
  getItemKey,
  items,
}: UseMultiSelectionOptions<T>): UseMultiSelectionResult<T> {
  const [selectedKeys, setSelectedKeys] = useState<ReadonlySet<string>>(
    () => new Set()
  );
  const [anchorKey, setAnchorKey] = useState<string | null>(null);

  const isSelected = useCallback(
    (item: T): boolean => {
      return selectedKeys.has(getItemKey(item));
    },
    [selectedKeys, getItemKey]
  );

  const selectSingle = useCallback(
    (item: T) => {
      const key = getItemKey(item);
      setSelectedKeys(new Set([key]));
      setAnchorKey(key);
    },
    [getItemKey]
  );

  const selectKeys = useCallback((keys: Iterable<string>) => {
    setSelectedKeys(new Set(keys));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedKeys(new Set());
    setAnchorKey(null);
  }, []);

  const selectAll = useCallback(() => {
    const allKeys = items.map(getItemKey);
    setSelectedKeys(new Set(allKeys));
    if (allKeys.length > 0 && allKeys[0] !== undefined) {
      setAnchorKey(allKeys[0]);
    }
  }, [items, getItemKey]);

  const handleClick = useCallback(
    (item: T, event: { shiftKey: boolean }) => {
      const key = getItemKey(item);

      if (event.shiftKey && anchorKey !== null) {
        // Shift+click: select range from anchor to clicked item
        const anchorIndex = items.findIndex(
          (i) => getItemKey(i) === anchorKey
        );
        const clickedIndex = items.findIndex((i) => getItemKey(i) === key);

        if (anchorIndex >= 0 && clickedIndex >= 0) {
          const start = Math.min(anchorIndex, clickedIndex);
          const end = Math.max(anchorIndex, clickedIndex);
          const rangeKeys = new Set<string>();
          for (let i = start; i <= end; i++) {
            const rangeItem = items[i];
            if (rangeItem !== undefined) {
              rangeKeys.add(getItemKey(rangeItem));
            }
          }
          setSelectedKeys(rangeKeys);
          // Keep anchor, don't change it on shift+click
        }
      } else {
        // Regular click: select single, set as anchor
        selectSingle(item);
      }
    },
    [getItemKey, items, anchorKey, selectSingle]
  );

  const getSelectedItems = useCallback((): T[] => {
    return items.filter((item) => selectedKeys.has(getItemKey(item)));
  }, [items, selectedKeys, getItemKey]);

  return {
    selectedKeys,
    anchorKey,
    isSelected,
    handleClick,
    selectSingle,
    selectKeys,
    clearSelection,
    selectAll,
    getSelectedItems,
    selectedCount: selectedKeys.size,
  };
}
