import { act, renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { useListKeyboard } from "../useListKeyboard";

interface TestItem {
  id: string;
  name: string;
  active?: boolean;
}

const createItems = (count: number): TestItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${i}`,
  }));

const createKeyEvent = (
  key: string,
  shiftKey = false
): React.KeyboardEvent => {
  return {
    key,
    shiftKey,
    preventDefault: vi.fn(),
  } as unknown as React.KeyboardEvent;
};

describe("useListKeyboard", () => {
  const getItemKey = (item: TestItem) => item.id;

  it("starts with null focus", () => {
    const items = createItems(3);
    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys: new Set(),
      })
    );

    expect(result.current.focusedIndex).toBeNull();
  });

  it("moveFocusUp/Down changes focus index", () => {
    const items = createItems(5);
    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys: new Set(),
      })
    );

    act(() => {
      result.current.setFocusedIndex(2);
    });
    expect(result.current.focusedIndex).toBe(2);

    act(() => {
      result.current.moveFocusUp();
    });
    expect(result.current.focusedIndex).toBe(1);

    act(() => {
      result.current.moveFocusDown();
    });
    expect(result.current.focusedIndex).toBe(2);
  });

  it("focus stays at bounds", () => {
    const items = createItems(3);
    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys: new Set(),
      })
    );

    // At top, can't go up
    act(() => {
      result.current.setFocusedIndex(0);
    });
    act(() => {
      result.current.moveFocusUp();
    });
    expect(result.current.focusedIndex).toBe(0);

    // At bottom, can't go down
    act(() => {
      result.current.setFocusedIndex(2);
    });
    act(() => {
      result.current.moveFocusDown();
    });
    expect(result.current.focusedIndex).toBe(2);
  });

  it("Home/End moves focus to first/last item", () => {
    const items = createItems(5);
    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys: new Set(),
      })
    );

    act(() => {
      result.current.setFocusedIndex(2);
    });

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Home"));
    });
    expect(result.current.focusedIndex).toBe(0);

    act(() => {
      result.current.handleKeyDown(createKeyEvent("End"));
    });
    expect(result.current.focusedIndex).toBe(4);
  });

  it("ArrowUp/Down without shift reorders items", () => {
    const items = createItems(5);
    const onReorder = vi.fn();
    const selectedKeys = new Set(["item-2"]);

    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys,
        onReorder,
        allowReorder: true,
      })
    );

    act(() => {
      result.current.setFocusedIndex(2);
    });

    // Move up
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowUp"));
    });

    expect(onReorder).toHaveBeenCalledTimes(1);
    const reorderedUp = onReorder.mock.calls[0]![0];
    expect(reorderedUp.map((i: TestItem) => i.id)).toEqual([
      "item-0",
      "item-2", // moved up
      "item-1",
      "item-3",
      "item-4",
    ]);

    onReorder.mockClear();

    // Move down (using original items since hook doesn't track state)
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown"));
    });

    expect(onReorder).toHaveBeenCalledTimes(1);
    const reorderedDown = onReorder.mock.calls[0]![0];
    expect(reorderedDown.map((i: TestItem) => i.id)).toEqual([
      "item-0",
      "item-1",
      "item-3", // swapped with item-2
      "item-2", // moved down
      "item-4",
    ]);
  });

  it("ArrowUp/Down with shift extends selection", () => {
    const items = createItems(5);
    const onSelectionChange = vi.fn();
    const selectedKeys = new Set(["item-2"]);

    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys,
        onSelectionChange,
        onReorder: vi.fn(),
        allowReorder: true,
      })
    );

    act(() => {
      result.current.setFocusedIndex(2);
    });

    // Shift+ArrowDown extends selection down
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown", true));
    });

    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    const newSelection = onSelectionChange.mock.calls[0]![0] as Set<string>;
    expect(newSelection.has("item-2")).toBe(true);
    expect(newSelection.has("item-3")).toBe(true);
    expect(newSelection.size).toBe(2);
  });

  it("cannot move past first/last item", () => {
    const items = createItems(3);
    const onReorder = vi.fn();

    // Select first item
    const selectedKeys = new Set(["item-0"]);

    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys,
        onReorder,
        allowReorder: true,
      })
    );

    act(() => {
      result.current.setFocusedIndex(0);
    });

    // Try to move up when at top
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowUp"));
    });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it("respects canReorderItem filter", () => {
    const items: TestItem[] = [
      { id: "item-0", name: "Item 0", active: true },
      { id: "item-1", name: "Item 1", active: true },
      { id: "item-2", name: "Item 2", active: false }, // Can't reorder
    ];
    const onReorder = vi.fn();
    const selectedKeys = new Set(["item-1"]);
    const canReorderItem = (item: TestItem) => item.active === true;

    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys,
        onReorder,
        allowReorder: true,
        canReorderItem,
      })
    );

    act(() => {
      result.current.setFocusedIndex(1);
    });

    // Try to move down into non-reorderable item
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowDown"));
    });

    // Should not reorder because item-2 is not reorderable
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("moves multiple selected items together", () => {
    const items = createItems(5);
    const onReorder = vi.fn();
    const selectedKeys = new Set(["item-1", "item-2"]);

    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys,
        onReorder,
        allowReorder: true,
      })
    );

    act(() => {
      result.current.setFocusedIndex(1);
    });

    // Move up
    act(() => {
      result.current.handleKeyDown(createKeyEvent("ArrowUp"));
    });

    expect(onReorder).toHaveBeenCalledTimes(1);
    const reordered = onReorder.mock.calls[0]![0];
    expect(reordered.map((i: TestItem) => i.id)).toEqual([
      "item-1", // moved up
      "item-2", // moved up
      "item-0", // pushed down
      "item-3",
      "item-4",
    ]);
  });

  it("ignores non-arrow/home/end keys", () => {
    const items = createItems(3);
    const onReorder = vi.fn();
    const onSelectionChange = vi.fn();

    const { result } = renderHook(() =>
      useListKeyboard({
        items,
        getItemKey,
        selectedKeys: new Set(["item-1"]),
        onReorder,
        onSelectionChange,
        allowReorder: true,
      })
    );

    act(() => {
      result.current.handleKeyDown(createKeyEvent("Enter"));
    });

    expect(onReorder).not.toHaveBeenCalled();
    expect(onSelectionChange).not.toHaveBeenCalled();
  });
});
