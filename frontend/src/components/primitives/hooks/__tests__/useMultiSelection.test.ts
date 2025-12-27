import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useMultiSelection } from "../useMultiSelection";

interface TestItem {
  id: string;
  name: string;
}

const createItems = (count: number): TestItem[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `item-${i}`,
    name: `Item ${i}`,
  }));

describe("useMultiSelection", () => {
  const getItemKey = (item: TestItem) => item.id;

  it("starts with empty selection", () => {
    const items = createItems(3);
    const { result } = renderHook(() =>
      useMultiSelection({ getItemKey, items })
    );

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.anchorKey).toBeNull();
    expect(result.current.isSelected(items[0]!)).toBe(false);
  });

  it("selectSingle selects one item and sets anchor", () => {
    const items = createItems(3);
    const { result } = renderHook(() =>
      useMultiSelection({ getItemKey, items })
    );

    act(() => {
      result.current.selectSingle(items[1]!);
    });

    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected(items[0]!)).toBe(false);
    expect(result.current.isSelected(items[1]!)).toBe(true);
    expect(result.current.isSelected(items[2]!)).toBe(false);
    expect(result.current.anchorKey).toBe("item-1");
  });

  it("handleClick without shift selects single item", () => {
    const items = createItems(3);
    const { result } = renderHook(() =>
      useMultiSelection({ getItemKey, items })
    );

    act(() => {
      result.current.handleClick(items[0]!, { shiftKey: false });
    });

    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected(items[0]!)).toBe(true);

    act(() => {
      result.current.handleClick(items[2]!, { shiftKey: false });
    });

    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected(items[0]!)).toBe(false);
    expect(result.current.isSelected(items[2]!)).toBe(true);
  });

  it("handleClick with shift selects range from anchor", () => {
    const items = createItems(5);
    const { result } = renderHook(() =>
      useMultiSelection({ getItemKey, items })
    );

    // First click sets anchor
    act(() => {
      result.current.handleClick(items[1]!, { shiftKey: false });
    });

    expect(result.current.anchorKey).toBe("item-1");
    expect(result.current.selectedCount).toBe(1);

    // Shift+click selects range
    act(() => {
      result.current.handleClick(items[3]!, { shiftKey: true });
    });

    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isSelected(items[0]!)).toBe(false);
    expect(result.current.isSelected(items[1]!)).toBe(true);
    expect(result.current.isSelected(items[2]!)).toBe(true);
    expect(result.current.isSelected(items[3]!)).toBe(true);
    expect(result.current.isSelected(items[4]!)).toBe(false);
    // Anchor should still be item-1
    expect(result.current.anchorKey).toBe("item-1");
  });

  it("shift+click works in reverse direction", () => {
    const items = createItems(5);
    const { result } = renderHook(() =>
      useMultiSelection({ getItemKey, items })
    );

    // Set anchor at item 3
    act(() => {
      result.current.handleClick(items[3]!, { shiftKey: false });
    });

    // Shift+click on item 1 (above anchor)
    act(() => {
      result.current.handleClick(items[1]!, { shiftKey: true });
    });

    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isSelected(items[0]!)).toBe(false);
    expect(result.current.isSelected(items[1]!)).toBe(true);
    expect(result.current.isSelected(items[2]!)).toBe(true);
    expect(result.current.isSelected(items[3]!)).toBe(true);
    expect(result.current.isSelected(items[4]!)).toBe(false);
  });

  it("clearSelection clears all selection and anchor", () => {
    const items = createItems(3);
    const { result } = renderHook(() =>
      useMultiSelection({ getItemKey, items })
    );

    act(() => {
      result.current.selectSingle(items[1]!);
    });

    expect(result.current.selectedCount).toBe(1);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedCount).toBe(0);
    expect(result.current.anchorKey).toBeNull();
  });

  it("selectAll selects all items", () => {
    const items = createItems(3);
    const { result } = renderHook(() =>
      useMultiSelection({ getItemKey, items })
    );

    act(() => {
      result.current.selectAll();
    });

    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isSelected(items[0]!)).toBe(true);
    expect(result.current.isSelected(items[1]!)).toBe(true);
    expect(result.current.isSelected(items[2]!)).toBe(true);
  });

  it("getSelectedItems returns items in order", () => {
    const items = createItems(5);
    const { result } = renderHook(() =>
      useMultiSelection({ getItemKey, items })
    );

    act(() => {
      result.current.handleClick(items[1]!, { shiftKey: false });
    });
    act(() => {
      result.current.handleClick(items[3]!, { shiftKey: true });
    });

    const selected = result.current.getSelectedItems();
    expect(selected).toHaveLength(3);
    expect(selected[0]).toBe(items[1]);
    expect(selected[1]).toBe(items[2]);
    expect(selected[2]).toBe(items[3]);
  });

  it("selectKeys sets selection by keys", () => {
    const items = createItems(5);
    const { result } = renderHook(() =>
      useMultiSelection({ getItemKey, items })
    );

    act(() => {
      result.current.selectKeys(["item-0", "item-2", "item-4"]);
    });

    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isSelected(items[0]!)).toBe(true);
    expect(result.current.isSelected(items[1]!)).toBe(false);
    expect(result.current.isSelected(items[2]!)).toBe(true);
    expect(result.current.isSelected(items[3]!)).toBe(false);
    expect(result.current.isSelected(items[4]!)).toBe(true);
  });
});
