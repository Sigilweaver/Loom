import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfigBoolean } from "../ConfigBoolean";

// Helper to check Radix checkbox state
const isChecked = (element: HTMLElement) =>
  element.getAttribute("data-state") === "checked";

describe("ConfigBoolean", () => {
  it("commits emission state when toggled", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = useState<boolean | undefined>(undefined);
      return (
        <ConfigBoolean
          value={value}
          onChange={(nextValue, emitPatch, shouldEmit) => {
            setValue(nextValue);
            handleChange(nextValue, emitPatch, shouldEmit);
          }}
          configKey="options.flag"
          label="Enable feature"
          description="Toggle to enable feature"
        />
      );
    };

    render(<Wrapper />);

    const checkbox = screen.getByRole("checkbox", { name: "Enable feature" });
    const description = screen.getByText("Toggle to enable feature");

    expect(isChecked(checkbox)).toBe(false);
    expect(checkbox.getAttribute("aria-describedby")).toBe(description.id);

    await user.click(checkbox);

    expect(handleChange).toHaveBeenLastCalledWith(
      true,
      { options: { flag: true } },
      true
    );
    expect(isChecked(checkbox)).toBe(true);

    handleChange.mockClear();

    await user.click(checkbox);

    // When returning to default (false), emission patch should be empty (not { flag: false })
    expect(handleChange).toHaveBeenLastCalledWith(undefined, {}, false);
    expect(isChecked(checkbox)).toBe(false);
  });
});
