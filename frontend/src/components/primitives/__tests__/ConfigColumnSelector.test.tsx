import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ConfigColumnSelector,
  ColumnSelectorItem,
  ColumnSelectorItemHandlers,
} from "../ConfigColumnSelector";

interface TestColumn extends ColumnSelectorItem {
  id: string;
  name: string;
  dtype: string;
  active?: boolean;
}

const createColumns = (count: number, activeCount = 0): TestColumn[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `col-${i}`,
    name: `Column ${i}`,
    dtype: i % 2 === 0 ? "String" : "Int64",
    active: i < activeCount,
  }));

const defaultItemRenderer = (
  item: TestColumn,
  handlers: ColumnSelectorItemHandlers
) => (
  <div data-testid={`item-${item.id}`}>
    <span>{item.name}</span>
    <span>{item.dtype}</span>
    {handlers.isSelected && <span data-testid="selected-indicator">Selected</span>}
    {handlers.isFocused && <span data-testid="focused-indicator">Focused</span>}
    {handlers.position > 0 && <span data-testid="position">{handlers.position}</span>}
  </div>
);

describe("ConfigColumnSelector", () => {
  it("renders items with itemRenderer", () => {
    const columns = createColumns(3);
    const onReorder = vi.fn();

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
        label="Test Columns"
      />
    );

    expect(screen.getByText("Column 0")).toBeInTheDocument();
    expect(screen.getByText("Column 1")).toBeInTheDocument();
    expect(screen.getByText("Column 2")).toBeInTheDocument();
    expect(screen.getByText("Test Columns")).toBeInTheDocument();
  });

  it("shows empty message when no items", () => {
    const onReorder = vi.fn();

    render(
      <ConfigColumnSelector
        items={[]}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
        emptyMessage="No columns available"
      />
    );

    expect(screen.getByText("No columns available")).toBeInTheDocument();
  });

  it("selects item on click", async () => {
    const user = userEvent.setup();
    const columns = createColumns(3);
    const onReorder = vi.fn();

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
      />
    );

    const item = screen.getByTestId("item-col-1");
    await user.click(item);

    // Should show selected indicator
    expect(screen.getByTestId("selected-indicator")).toBeInTheDocument();
  });

  it("shift+click selects range", async () => {
    const user = userEvent.setup();
    const columns = createColumns(5);
    const onReorder = vi.fn();

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
      />
    );

    // Click first item
    await user.click(screen.getByTestId("item-col-1"));
    expect(screen.getByTestId("selected-indicator")).toBeInTheDocument();

    // Shift+click third item
    await user.keyboard("{Shift>}");
    await user.click(screen.getByTestId("item-col-3"));
    await user.keyboard("{/Shift}");

    // All three items from col-1 to col-3 should be selected
    expect(screen.getAllByTestId("selected-indicator")).toHaveLength(3);
  });

  it("multi-select reorder preserves visual selection", async () => {
    const user = userEvent.setup();
    let columns = createColumns(5);
    const onReorder = vi.fn().mockImplementation((newItems) => {
      columns = newItems;
    });

    const { rerender } = render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
      />
    );

    // Click item at index 1
    await user.click(screen.getByTestId("item-col-1"));

    // Shift+click item at index 3 to select 3 items (col-1, col-2, col-3)
    await user.keyboard("{Shift>}");
    await user.click(screen.getByTestId("item-col-3"));
    await user.keyboard("{/Shift}");

    // Verify 3 items are selected
    expect(screen.getAllByTestId("selected-indicator")).toHaveLength(3);

    // Press ArrowDown to move all 3 selected items down
    await user.keyboard("{ArrowDown}");

    // onReorder should have been called
    expect(onReorder).toHaveBeenCalled();

    // Re-render with the new items (simulating parent state update)
    rerender(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
      />
    );

    // After re-render, all 3 items should STILL be visually selected
    expect(screen.getAllByTestId("selected-indicator")).toHaveLength(3);
  });

  it("multi-select reorder preserves selection with stateful wrapper", async () => {
    const user = userEvent.setup();

    // Create a wrapper component that manages state like a real parent
    function Wrapper() {
      const [items, setItems] = useState(() => createColumns(5));
      return (
        <ConfigColumnSelector
          items={items}
          onReorder={setItems}
          itemRenderer={defaultItemRenderer}
        />
      );
    }

    render(<Wrapper />);

    // Click item at index 1
    await user.click(screen.getByTestId("item-col-1"));

    // Shift+click item at index 3 to select 3 items (col-1, col-2, col-3)
    await user.keyboard("{Shift>}");
    await user.click(screen.getByTestId("item-col-3"));
    await user.keyboard("{/Shift}");

    // Verify 3 items are selected
    expect(screen.getAllByTestId("selected-indicator")).toHaveLength(3);

    // Press ArrowDown to move all 3 selected items down
    await user.keyboard("{ArrowDown}");

    // After state update and re-render, all 3 items should STILL be visually selected
    expect(screen.getAllByTestId("selected-indicator")).toHaveLength(3);
  });

  it("arrow keys reorder selected items", async () => {
    const user = userEvent.setup();
    const columns = createColumns(5);
    const onReorder = vi.fn();

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
      />
    );

    // Focus the list
    const list = screen.getByRole("listbox");
    await user.click(list);

    // Select item at index 2
    await user.click(screen.getByTestId("item-col-2"));

    // Press arrow up to move it
    await user.keyboard("{ArrowUp}");

    expect(onReorder).toHaveBeenCalled();
    const reorderedItems = onReorder.mock.calls[0]![0];
    expect(reorderedItems.map((c: TestColumn) => c.id)).toEqual([
      "col-0",
      "col-2", // moved up
      "col-1",
      "col-3",
      "col-4",
    ]);
  });

  it("shift+arrow extends selection", async () => {
    const user = userEvent.setup();
    const columns = createColumns(5);
    const onReorder = vi.fn();

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
      />
    );

    // Select item at index 2
    await user.click(screen.getByTestId("item-col-2"));
    expect(screen.getByTestId("selected-indicator")).toBeInTheDocument();

    // Shift+ArrowDown to extend selection
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");

    // Two items should be selected
    expect(screen.getAllByTestId("selected-indicator")).toHaveLength(2);
  });

  it("respects canReorderItem filter", async () => {
    const user = userEvent.setup();
    const columns = createColumns(5, 3); // First 3 are active
    const onReorder = vi.fn();
    const canReorderItem = (item: TestColumn) => item.active === true;

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
        canReorderItem={canReorderItem}
      />
    );

    // Select an active item at boundary
    await user.click(screen.getByTestId("item-col-2"));

    // Try to move it down into inactive section
    await user.keyboard("{ArrowDown}");

    // Should not reorder
    expect(onReorder).not.toHaveBeenCalled();
  });

  it("shows keyboard hints", () => {
    const columns = createColumns(3);
    const onReorder = vi.fn();

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
      />
    );

    expect(screen.getByText("Click to select")).toBeInTheDocument();
    expect(screen.getByText("Shift+Click for range")).toBeInTheDocument();
    expect(screen.getByText("Arrow keys to reorder")).toBeInTheDocument();
  });

  it("disables interaction when disabled", async () => {
    const user = userEvent.setup();
    const columns = createColumns(3);
    const onReorder = vi.fn();

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
        disabled
      />
    );

    // Try to click - should not select
    await user.click(screen.getByTestId("item-col-1"));
    expect(screen.queryByText("(1 selected)")).not.toBeInTheDocument();
  });

  it("shows reorder buttons and they work", async () => {
    const user = userEvent.setup();
    const columns = createColumns(5);
    const onReorder = vi.fn();

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
        showReorderButtons
      />
    );

    // Select item at index 2
    await user.click(screen.getByTestId("item-col-2"));

    // Click move up button
    const moveUpButton = screen.getByTitle("Move selection up (Arrow Up)");
    await user.click(moveUpButton);

    expect(onReorder).toHaveBeenCalled();
  });

  it("passes position info to itemRenderer", () => {
    const columns = createColumns(5, 3); // First 3 are active
    const onReorder = vi.fn();
    const canReorderItem = (item: TestColumn) => item.active === true;

    render(
      <ConfigColumnSelector
        items={columns}
        onReorder={onReorder}
        itemRenderer={defaultItemRenderer}
        canReorderItem={canReorderItem}
      />
    );

    // Active items should have positions
    const positions = screen.getAllByTestId("position");
    expect(positions).toHaveLength(3);
    expect(positions[0]).toHaveTextContent("1");
    expect(positions[1]).toHaveTextContent("2");
    expect(positions[2]).toHaveTextContent("3");
  });
});
