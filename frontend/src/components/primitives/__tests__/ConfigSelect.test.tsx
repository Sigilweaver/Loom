import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfigSelect } from "../ConfigSelect";

const DELIMITER_OPTIONS = [
  { value: ",", label: "Comma (,)" },
  { value: "\t", label: "Tab (\\t)" },
  { value: "|", label: "Pipe (|)" },
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
          options={DELIMITER_OPTIONS}
          defaultValue=","
          placeholder="Choose delimiter"
          emptyOptionLabel="Choose delimiter"
        />
      );
    };

    render(<Wrapper />);

    const trigger = screen.getByRole("button", { name: "Delimiter" });
    expect(trigger).toHaveTextContent("Comma (,)");

    await user.click(trigger);
    const tabOption = await screen.findByRole("option", { name: /Tab/ });
    await user.click(tabOption);

    expect(handleChange).toHaveBeenLastCalledWith(
      "\t",
      { csv: { delimiter: true } },
      true
    );

    await user.click(trigger);
    const placeholderOption = screen.getByRole("option", {
      name: /Choose delimiter/i,
    });
    await user.click(placeholderOption);

    // When returning to default, emission patch should be empty (not { delimiter: false })
    expect(handleChange).toHaveBeenLastCalledWith(undefined, {}, false);
  });

  it("shows the default option label when no value is provided", () => {
    render(
      <ConfigSelect
        value={undefined}
        onChange={vi.fn()}
        configKey="csv.delimiter"
        label="Delimiter"
        options={DELIMITER_OPTIONS}
        defaultValue=","
        placeholder="Use detected delimiter"
        emptyOptionLabel="Use detected delimiter"
      />
    );

    const trigger = screen.getByRole("button", { name: "Delimiter" });
    expect(trigger).toHaveTextContent("Comma (,)");
  });

  it("emits a literal tab character when the Tab option is selected", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ConfigSelect
        value={undefined}
        onChange={handleChange}
        configKey="csv.delimiter"
        label="Delimiter"
        options={DELIMITER_OPTIONS}
        defaultValue=","
        placeholder="Use detected delimiter"
        emptyOptionLabel="Use detected delimiter"
      />
    );

    const trigger = screen.getByRole("button", { name: "Delimiter" });
    await user.click(trigger);

    const tabOption = await screen.findByRole("option", { name: /Tab/ });
    await user.click(tabOption);

    expect(handleChange).toHaveBeenLastCalledWith(
      "\t",
      { csv: { delimiter: true } },
      true
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
        options={DELIMITER_OPTIONS}
        searchable
      />
    );

    const trigger = screen.getByRole("button", { name: "Encoding" });
    await user.click(trigger);

    const search = await screen.findByPlaceholderText("Search options...");
    await user.type(search, "tab");

    const optionsAfterFilter = screen.getAllByRole("option");
    expect(
      optionsAfterFilter.map((option) => option.textContent?.trim())
    ).toEqual(["Tab (\\t)"]);

    await user.clear(search);
    await user.type(search, "zzz");

    const noMatchMessages = await screen.findAllByText(
      "No options match your search."
    );
    expect(noMatchMessages.length).toBeGreaterThan(0);
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
    const trigger = screen.getByRole("button", { name: "Encoding" });
    expect(trigger).toBeDisabled();
  });
});
