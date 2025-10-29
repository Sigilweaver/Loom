import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  ConfigNumberRange,
  type ConfigNumberRangeValue,
} from "../ConfigNumberRange";

describe("ConfigNumberRange", () => {
  it("commits valid ranges and reverts when cleared", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = useState<ConfigNumberRangeValue | undefined>(
        undefined
      );
      return (
        <ConfigNumberRange
          value={value}
          onChange={(nextValue, emitPatch, shouldEmit) => {
            setValue(nextValue);
            handleChange(nextValue, emitPatch, shouldEmit);
          }}
          configKey="csv.rowRange"
          label="Row range"
          debounceMs={0}
        />
      );
    };

    render(<Wrapper />);

    const start = screen.getByLabelText("Start") as HTMLInputElement;
    const end = screen.getByLabelText("End") as HTMLInputElement;

    await user.type(start, "2");
    await user.type(end, "5");

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        { start: 2, end: 5 },
        { csv: { rowRange: true } },
        true
      );
    });

    await user.clear(start);
    await user.clear(end);

    await waitFor(() => {
      // When returning to default (empty/undefined), emission patch should be empty (not { rowRange: false })
      expect(handleChange).toHaveBeenLastCalledWith(undefined, {}, false);
    });
  });

  it("enforces required validation after blur", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <ConfigNumberRange
        value={undefined}
        onChange={handleChange}
        configKey="csv.batch"
        label="Batch range"
        required
        validationMode="blur"
        debounceMs={0}
      />
    );

    const start = screen.getByLabelText("Start") as HTMLInputElement;
    const end = screen.getByLabelText("End") as HTMLInputElement;

    await user.type(start, "1");
    await user.click(end);
    await user.tab();

    const message = await screen.findByText(
      "Provide both start and end values."
    );
    expect(message).toHaveAttribute("role", "alert");
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("clamps values within bounds when requested", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = useState<ConfigNumberRangeValue | undefined>(
        undefined
      );
      return (
        <ConfigNumberRange
          value={value}
          onChange={(nextValue, emitPatch, shouldEmit) => {
            setValue(nextValue);
            handleChange(nextValue, emitPatch, shouldEmit);
          }}
          configKey="csv.offsetRange"
          label="Offset range"
          min={0}
          max={10}
          clampToBounds
          debounceMs={0}
        />
      );
    };

    render(<Wrapper />);

    const start = screen.getByLabelText("Start") as HTMLInputElement;
    const end = screen.getByLabelText("End") as HTMLInputElement;

    await user.type(start, "-5");
    await user.type(end, "15");

    await waitFor(() => {
      expect(handleChange).toHaveBeenLastCalledWith(
        { start: 0, end: 10 },
        { csv: { offsetRange: true } },
        true
      );
    });

    await waitFor(() => {
      expect(start.value).toBe("0");
      expect(end.value).toBe("10");
    });
  });
});
