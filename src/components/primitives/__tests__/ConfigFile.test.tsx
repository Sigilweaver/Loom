import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfigFile } from "../ConfigFile";

describe("ConfigFile", () => {
  it("emits new path and handles description mapping", () => {
    const handleChange = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = useState<string | undefined>(undefined);
      return (
        <ConfigFile
          value={value}
          onChange={(nextValue, emitPatch, shouldEmit) => {
            setValue(nextValue);
            handleChange(nextValue, emitPatch, shouldEmit);
          }}
          configKey="file.path"
          label="File Path"
          description="Path to the file"
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByLabelText("File Path") as HTMLInputElement;
    const description = screen.getByText("Path to the file");

    expect(input.value).toBe("");
    expect(input.getAttribute("aria-describedby")).toBe(description.id);

    fireEvent.change(input, { target: { value: "/tmp/example.csv" } });

    expect(handleChange).toHaveBeenLastCalledWith(
      "/tmp/example.csv",
      { file: { path: true } },
      true
    );
  });

  it("clears emission when the value returns to default", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = useState<string | undefined>(undefined);
      return (
        <ConfigFile
          value={value}
          onChange={(nextValue, emitPatch, shouldEmit) => {
            setValue(nextValue);
            handleChange(nextValue, emitPatch, shouldEmit);
          }}
          configKey="file.path"
          label="File Path"
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByLabelText("File Path") as HTMLInputElement;

    await user.type(input, "value");

    expect(handleChange).toHaveBeenLastCalledWith(
      "value",
      { file: { path: true } },
      true
    );

    handleChange.mockClear();

    fireEvent.change(input, { target: { value: "" } });

    expect(handleChange).toHaveBeenLastCalledWith(
      undefined,
      { file: { path: false } },
      false
    );
  });
});
