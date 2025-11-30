import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfigMultiSelect } from "../ConfigMultiSelect";

const COLUMN_OPTIONS = [
  { value: "id", label: "id", description: "Integer" },
  { value: "name", label: "name", description: "String" },
  { value: "age", label: "age", description: "Integer" },
  { value: "email", label: "email", description: "String" },
  { value: "active", label: "active", description: "Boolean" },
];

const DISABLED_OPTION = { value: "disabled", label: "disabled", disabled: true };

describe("ConfigMultiSelect", () => {
  describe("Rendering", () => {
    it("renders with label and placeholder when no selection", () => {
      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          placeholder="Select columns..."
        />
      );

      expect(screen.getByText("Columns")).toBeInTheDocument();
      expect(screen.getByText("Select columns...")).toBeInTheDocument();
    });

    it("shows selection count when values are selected", () => {
      render(
        <ConfigMultiSelect
          value={["id", "name"]}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
        />
      );

      expect(screen.getByText("2 selected")).toBeInTheDocument();
    });

    it("displays selected tags below the trigger", () => {
      render(
        <ConfigMultiSelect
          value={["id", "name"]}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
        />
      );

      expect(screen.getByText("id")).toBeInTheDocument();
      expect(screen.getByText("name")).toBeInTheDocument();
    });

    it("shows max selections counter when maxSelections is set", () => {
      render(
        <ConfigMultiSelect
          value={["id"]}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          maxSelections={3}
        />
      );

      expect(screen.getByText("1 / 3 selected")).toBeInTheDocument();
    });

    it("renders description when provided", () => {
      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          description="Select the columns to include"
        />
      );

      expect(screen.getByText("Select the columns to include")).toBeInTheDocument();
    });

    it("shows disabled state when disabled", () => {
      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          disabled
        />
      );

      const trigger = screen.getByRole("button", { name: "Columns" });
      expect(trigger).toBeDisabled();
    });
  });

  describe("Dropdown Interaction", () => {
    it("opens dropdown on trigger click", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
        />
      );

      const trigger = screen.getByRole("button", { name: "Columns" });
      await user.click(trigger);

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("shows all options in dropdown", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));

      for (const option of COLUMN_OPTIONS) {
        expect(screen.getByRole("option", { name: new RegExp(option.label) })).toBeInTheDocument();
      }
    });

    it("closes dropdown when clicking outside", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <span data-testid="outside">Outside</span>
          <ConfigMultiSelect
            value={undefined}
            onChange={vi.fn()}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
          />
        </div>
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      await user.click(screen.getByTestId("outside"));
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });

    it("does not open dropdown when disabled", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          disabled
        />
      );

      const trigger = screen.getByRole("button", { name: "Columns" });
      await user.click(trigger);

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("Selection Behavior", () => {
    it("selects an option when clicked", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(undefined);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
          />
        );
      };

      render(<Wrapper />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("option", { name: /^id/ }));

      expect(handleChange).toHaveBeenCalledWith(
        ["id"],
        { columns: true },
        true
      );
    });

    it("allows multiple selections", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(undefined);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
          />
        );
      };

      render(<Wrapper />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("option", { name: /^id/ }));
      await user.click(screen.getByRole("option", { name: /^name/ }));

      expect(handleChange).toHaveBeenLastCalledWith(
        ["id", "name"],
        { columns: true },
        true
      );
    });

    it("deselects an option when clicked again", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(["id", "name"]);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
          />
        );
      };

      render(<Wrapper />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("option", { name: /^id/ }));

      expect(handleChange).toHaveBeenCalledWith(
        ["name"],
        { columns: true },
        true
      );
    });

    it("respects maxSelections limit", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(["id", "name"]);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
            maxSelections={2}
          />
        );
      };

      render(<Wrapper />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      // Try to select a third option
      await user.click(screen.getByRole("option", { name: /^age/ }));

      // Should not have been called with 3 items
      expect(handleChange).not.toHaveBeenCalledWith(
        expect.arrayContaining(["age"]),
        expect.anything(),
        expect.anything()
      );
    });

    it("can still deselect when at maxSelections", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(["id", "name"]);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
            maxSelections={2}
          />
        );
      };

      render(<Wrapper />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("option", { name: /^id/ }));

      expect(handleChange).toHaveBeenCalledWith(
        ["name"],
        { columns: true },
        true
      );
    });

    it("skips disabled options", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={handleChange}
          configKey="columns"
          options={[...COLUMN_OPTIONS, DISABLED_OPTION]}
          label="Columns"
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("option", { name: /^disabled/ }));

      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe("Tag Removal", () => {
    it("removes selection via tag remove button", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(["id", "name"]);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
          />
        );
      };

      render(<Wrapper />);

      const removeButton = screen.getByRole("button", { name: "Remove id" });
      await user.click(removeButton);

      expect(handleChange).toHaveBeenCalledWith(
        ["name"],
        { columns: true },
        true
      );
    });

    it("clears to undefined when removing last selection", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(["id"]);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
            defaultValue={[]}
          />
        );
      };

      render(<Wrapper />);

      const removeButton = screen.getByRole("button", { name: "Remove id" });
      await user.click(removeButton);

      expect(handleChange).toHaveBeenCalledWith(
        undefined,
        {},
        false
      );
    });
  });

  describe("Select All / Clear All", () => {
    it("selects all options when Select All is clicked", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(undefined);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
            showSelectAll
          />
        );
      };

      render(<Wrapper />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("button", { name: "Select All" }));

      expect(handleChange).toHaveBeenCalledWith(
        ["id", "name", "age", "email", "active"],
        { columns: true },
        true
      );
    });

    it("respects maxSelections when selecting all", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(undefined);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
            showSelectAll
            maxSelections={3}
          />
        );
      };

      render(<Wrapper />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("button", { name: "Select All" }));

      const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1];
      expect(lastCall?.[0]?.length).toBe(3);
    });

    it("clears all selections when Clear All is clicked", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(["id", "name"]);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
            showClearAll
            defaultValue={[]}
          />
        );
      };

      render(<Wrapper />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("button", { name: "Clear All" }));

      expect(handleChange).toHaveBeenCalledWith(
        undefined,
        {},
        false
      );
    });

    it("disables Clear All when nothing is selected", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          showClearAll
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));
      
      const clearAllButton = screen.getByRole("button", { name: "Clear All" });
      expect(clearAllButton).toBeDisabled();
    });

    it("hides Select All / Clear All when showSelectAll and showClearAll are false", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          showSelectAll={false}
          showClearAll={false}
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));

      expect(screen.queryByRole("button", { name: "Select All" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Clear All" })).not.toBeInTheDocument();
    });
  });

  describe("Search Functionality", () => {
    it("filters options by search term", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          searchable
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));

      const searchInput = screen.getByPlaceholderText("Search options...");
      await user.type(searchInput, "name");

      // Only "name" option should be visible
      expect(screen.getByRole("option", { name: /^name/ })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: /^id/ })).not.toBeInTheDocument();
    });

    it("shows no match message when search has no results", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          searchable
          searchNoMatchMessage="No columns match"
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));

      const searchInput = screen.getByPlaceholderText("Search options...");
      await user.type(searchInput, "zzz");

      // Message appears in both the list and validation area
      const messages = screen.getAllByText("No columns match");
      expect(messages.length).toBeGreaterThan(0);
    });

    it("searches by description when provided", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          searchable
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));

      const searchInput = screen.getByPlaceholderText("Search options...");
      await user.type(searchInput, "Integer");

      // id and age have Integer description
      expect(screen.getByRole("option", { name: /^id/ })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /^age/ })).toBeInTheDocument();
      expect(screen.queryByRole("option", { name: /^name/ })).not.toBeInTheDocument();
    });

    it("hides search when searchable is false", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          searchable={false}
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));

      expect(screen.queryByPlaceholderText("Search options...")).not.toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty message when no options available", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={[]}
          label="Columns"
          noOptionsMessage="No columns available"
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));

      // Message appears in both the list and validation area
      const messages = screen.getAllByText("No columns available");
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe("Reordering", () => {
    it("shows drag handles when allowReorder is true", () => {
      render(
        <ConfigMultiSelect
          value={["id", "name"]}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          allowReorder
        />
      );

      // Drag handle markers should be visible
      const handles = screen.getAllByText("\u22EE\u22EE"); // Vertical dots character
      expect(handles.length).toBe(2);
    });
  });

  describe("Emission Behavior", () => {
    it("emits true when value differs from default", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(undefined);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
            defaultValue={[]}
          />
        );
      };

      render(<Wrapper />);

      await user.click(screen.getByRole("button", { name: "Columns" }));
      await user.click(screen.getByRole("option", { name: /^id/ }));

      expect(handleChange).toHaveBeenCalledWith(
        ["id"],
        { columns: true },
        true
      );
    });

    it("emits false when value returns to default", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<string[] | undefined>(["id"]);
        return (
          <ConfigMultiSelect
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="columns"
            options={COLUMN_OPTIONS}
            label="Columns"
            defaultValue={[]}
          />
        );
      };

      render(<Wrapper />);

      // Remove the only selected item
      const removeButton = screen.getByRole("button", { name: "Remove id" });
      await user.click(removeButton);

      expect(handleChange).toHaveBeenCalledWith(
        undefined,
        {},
        false
      );
    });
  });

  describe("Keyboard Navigation", () => {
    it("opens dropdown on Enter key", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
        />
      );

      const trigger = screen.getByRole("button", { name: "Columns" });
      trigger.focus();
      await user.keyboard("{Enter}");

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("opens dropdown on ArrowDown key", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
        />
      );

      const trigger = screen.getByRole("button", { name: "Columns" });
      trigger.focus();
      await user.keyboard("{ArrowDown}");

      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    it("closes dropdown on Escape key", async () => {
      const user = userEvent.setup();

      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          searchable={false} // Disable search so focus goes to listbox
        />
      );

      await user.click(screen.getByRole("button", { name: "Columns" }));
      expect(screen.getByRole("listbox")).toBeInTheDocument();

      // Focus is on the listbox when searchable=false
      const listbox = screen.getByRole("listbox");
      listbox.focus();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  describe("Required Field", () => {
    it("passes required prop to ConfigField", () => {
      render(
        <ConfigMultiSelect
          value={undefined}
          onChange={vi.fn()}
          configKey="columns"
          options={COLUMN_OPTIONS}
          label="Columns"
          required
        />
      );

      // Required indicator should be present
      expect(screen.getByText("*")).toBeInTheDocument();
    });
  });
});
