import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ConfigSelect } from "../ConfigSelect";

const OPTIONS = [
  { value: "comma", label: "Comma" },
  { value: "tab", label: "Tab" },
  { value: "pipe", label: "Pipe" },
];

describe("ConfigSelect", () => {
  it("emits selected value relative to default", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = useState<string | undefined>(undefined);
      return (
        <ConfigSelect
          value={value}
          onChange={(nextValue, emitPatch, shouldEmit) => {
            setValue(nextValue);
            handleChange(nextValue, emitPatch, shouldEmit);
          }}
          configKey="csv.delimiter"
          label="Delimiter"
          options={OPTIONS}
          defaultValue={","}
          placeholder="Choose delimiter"
        />
      );
    };

    render(<Wrapper />);

    const select = screen.getByLabelText("Delimiter") as HTMLSelectElement;

    await user.selectOptions(select, "tab");

    expect(handleChange).toHaveBeenLastCalledWith(
      "tab",
      { csv: { delimiter: true } },
      true
    );

    await user.selectOptions(select, "");

    expect(handleChange).toHaveBeenLastCalledWith(
      undefined,
      { csv: { delimiter: false } },
      false
    );
  });

  it("filters options when search is enabled", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ConfigSelect
        value={undefined}
        onChange={handleChange}
        configKey="csv.encoding"
        label="Encoding"
        options={OPTIONS}
        searchable
      />
    );

    const search = screen.getByPlaceholderText(
      "Search options..."
    ) as HTMLInputElement;

    await user.type(search, "tab");

    const optionsAfterFilter = screen.getAllByRole("option");
    expect(optionsAfterFilter.map((option) => option.textContent)).toEqual([
      "Choose an option",
      "Tab",
    ]);

    await user.clear(search);
    await user.type(search, "zzz");

    expect(
      await screen.findByText("No options match your search.")
    ).toBeInTheDocument();
  });

  it("displays base empty message when no options are available", () => {
    render(
      <ConfigSelect
        value={undefined}
        onChange={vi.fn()}
        configKey="csv.encoding"
        label="Encoding"
        options={[]}
      />
    );

    expect(screen.getByText("No options available.")).toBeInTheDocument();
    const select = screen.getByLabelText("Encoding") as HTMLSelectElement;
    expect(select.disabled).toBe(true);
  });
});
