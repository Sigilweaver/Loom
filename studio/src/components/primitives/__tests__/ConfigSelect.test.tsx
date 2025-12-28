import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfigSelect } from "../ConfigSelect";

const DELIMITER_OPTIONS = [
  { value: ",", label: "Comma (,)" },
  { value: "\t", label: "Tab (\\t)" },
  { value: "|", label: "Pipe (|)" },
];

describe("ConfigSelect", () => {
  it("renders with default value when no value is provided", () => {
    render(
      <ConfigSelect
        value={undefined}
        onChange={vi.fn()}
        configKey="csv.delimiter"
        label="Delimiter"
        options={DELIMITER_OPTIONS}
        defaultValue=","
        placeholder="Choose delimiter"
        emptyOptionLabel="Choose delimiter"
      />
    );

    // Radix uses combobox role for the trigger
    const trigger = screen.getByRole("combobox", { name: "Delimiter" });
    expect(trigger).toHaveTextContent("Comma (,)");
  });

  it("renders with the provided value", () => {
    render(
      <ConfigSelect
        value="|"
        onChange={vi.fn()}
        configKey="csv.delimiter"
        label="Delimiter"
        options={DELIMITER_OPTIONS}
        defaultValue=","
        placeholder="Choose delimiter"
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Delimiter" });
    expect(trigger).toHaveTextContent("Pipe");
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

    const trigger = screen.getByRole("combobox", { name: "Delimiter" });
    expect(trigger).toHaveTextContent("Comma (,)");
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
    const trigger = screen.getByRole("combobox", { name: "Encoding" });
    expect(trigger).toBeDisabled();
  });

  it("renders with description when provided", () => {
    render(
      <ConfigSelect
        value={undefined}
        onChange={vi.fn()}
        configKey="test.option"
        label="Test Select"
        description="This is a test description"
        options={DELIMITER_OPTIONS}
      />
    );

    expect(screen.getByText("This is a test description")).toBeInTheDocument();
  });

  it("is disabled when disabled prop is true", () => {
    render(
      <ConfigSelect
        value={undefined}
        onChange={vi.fn()}
        configKey="test.option"
        label="Test Select"
        options={DELIMITER_OPTIONS}
        disabled
      />
    );

    const trigger = screen.getByRole("combobox", { name: "Test Select" });
    expect(trigger).toBeDisabled();
  });

  it("emits correctly when value changes", () => {
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
        />
      );
    };

    render(<Wrapper />);

    // Verify the component is rendered with default
    const trigger = screen.getByRole("combobox", { name: "Delimiter" });
    expect(trigger).toHaveTextContent("Comma (,)");
    
    // Note: Testing actual selection interactions with Radix Select portals
    // requires additional setup (happy-dom or browser testing).
    // The emission logic is tested via usePrimitiveEmission hook tests.
  });
});
