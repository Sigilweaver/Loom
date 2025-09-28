import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfigText } from "../ConfigText";

describe("ConfigText", () => {
  it("normalizes and emits trimmed values when valid", async () => {
    const handleChange = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = useState<string | undefined>(undefined);
      return (
        <ConfigText
          value={value}
          onChange={(nextValue, emitPatch, shouldEmit) => {
            setValue(nextValue);
            handleChange(nextValue, emitPatch, shouldEmit);
          }}
          configKey="options.name"
          label="Name"
          description="Provide a name"
          trim
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByLabelText("Name") as HTMLInputElement;
    const description = screen.getByText("Provide a name");

    expect(input.getAttribute("aria-describedby")).toBe(description.id);

    fireEvent.change(input, { target: { value: "  Hello  " } });

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        "Hello",
        { options: { name: true } },
        true
      );
    });
  });

  it("defers validation messaging until blur in blur mode", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = useState<string | undefined>(undefined);
      return (
        <ConfigText
          value={value}
          onChange={(nextValue, emitPatch, shouldEmit) => {
            setValue(nextValue);
            handleChange(nextValue, emitPatch, shouldEmit);
          }}
          configKey="options.requiredField"
          label="Required Field"
          description="This field is required"
          required
          validation={{ mode: "blur" }}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole("textbox") as HTMLInputElement;
    const description = screen.getByText("This field is required");

    expect(input.getAttribute("aria-describedby")).toBe(description.id);

    await user.click(input);
    await user.tab();

    const message = await screen.findByText("This field is required.");

    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBe(`${description.id} ${message.id}`);
    expect(handleChange).not.toHaveBeenCalled();
    expect(message).toHaveAttribute("role", "alert");
  });
});
