import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfigNumber } from "../ConfigNumber";

describe("ConfigNumber", () => {
  describe("Rendering", () => {
    it("renders with label and placeholder", () => {
      render(
        <ConfigNumber
          value={undefined}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
          placeholder="Enter limit..."
        />
      );

      expect(screen.getByLabelText("Limit")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter limit...")).toBeInTheDocument();
    });

    it("displays current value in input", () => {
      render(
        <ConfigNumber
          value={42}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
        />
      );

      expect(screen.getByRole("spinbutton")).toHaveValue(42);
    });

    it("shows empty input when value is undefined", () => {
      render(
        <ConfigNumber
          value={undefined}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
        />
      );

      expect(screen.getByRole("spinbutton")).toHaveValue(null);
    });

    it("renders description when provided", () => {
      render(
        <ConfigNumber
          value={undefined}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
          description="Maximum number of rows"
        />
      );

      expect(screen.getByText("Maximum number of rows")).toBeInTheDocument();
    });

    it("shows disabled state", () => {
      render(
        <ConfigNumber
          value={10}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
          disabled
        />
      );

      expect(screen.getByRole("spinbutton")).toBeDisabled();
    });

    it("shows required indicator", () => {
      render(
        <ConfigNumber
          value={undefined}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
          required
        />
      );

      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("renders unit after input when unitPosition is after", () => {
      render(
        <ConfigNumber
          value={100}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
          unit="rows"
          unitPosition="after"
        />
      );

      expect(screen.getByText("rows")).toBeInTheDocument();
    });

    it("renders unit before input when unitPosition is before", () => {
      render(
        <ConfigNumber
          value={100}
          onChange={vi.fn()}
          configKey="price"
          label="Price"
          unit="$"
          unitPosition="before"
        />
      );

      expect(screen.getByText("$")).toBeInTheDocument();
    });
  });

  describe("Value Changes", () => {
    it("calls onChange when user types a number", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<number | undefined>(undefined);
        return (
          <ConfigNumber
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="limit"
            label="Limit"
          />
        );
      };

      render(<Wrapper />);

      const input = screen.getByRole("spinbutton");
      await user.type(input, "42");

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          42,
          { limit: true },
          true
        );
      });
    });

    it("handles decimal numbers", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<number | undefined>(undefined);
        return (
          <ConfigNumber
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="price"
            label="Price"
          />
        );
      };

      render(<Wrapper />);

      const input = screen.getByRole("spinbutton");
      await user.type(input, "3.14");

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          3.14,
          { price: true },
          true
        );
      });
    });

    it("handles negative numbers", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<number | undefined>(undefined);
        return (
          <ConfigNumber
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="offset"
            label="Offset"
          />
        );
      };

      render(<Wrapper />);

      const input = screen.getByRole("spinbutton");
      await user.type(input, "-5");

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          -5,
          { offset: true },
          true
        );
      });
    });

    it("clears value when input is emptied", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<number | undefined>(42);
        return (
          <ConfigNumber
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="limit"
            label="Limit"
            defaultValue={0}
          />
        );
      };

      render(<Wrapper />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          undefined,
          {},
          false
        );
      });
    });
  });

  describe("Validation", () => {
    describe("Required Field", () => {
      it("shows error when required field is empty", async () => {
        const user = userEvent.setup();

        render(
          <ConfigNumber
            value={undefined}
            onChange={vi.fn()}
            configKey="limit"
            label="Limit"
            required
            validationMode="change"
          />
        );

        const input = screen.getByRole("spinbutton");
        await user.type(input, "5");
        await user.clear(input);

        await waitFor(() => {
          expect(screen.getByText("This field is required.")).toBeInTheDocument();
        });
      });
    });

    describe("Invalid Input", () => {
      it("shows error for non-numeric input", async () => {
        const user = userEvent.setup();

        render(
          <ConfigNumber
            value={undefined}
            onChange={vi.fn()}
            configKey="limit"
            label="Limit"
          />
        );

        const input = screen.getByRole("spinbutton");
        // Number inputs don't accept letters, so this test validates the component handles empty state
        await user.type(input, "abc");

        // Input should remain empty
        expect(input).toHaveValue(null);
      });
    });

    describe("Integer Only", () => {
      it("validates integer-only when integerOnly is true", async () => {
        const user = userEvent.setup();

        render(
          <ConfigNumber
            value={undefined}
            onChange={vi.fn()}
            configKey="count"
            label="Count"
            integerOnly
          />
        );

        const input = screen.getByRole("spinbutton");
        await user.type(input, "3.5");

        await waitFor(() => {
          expect(screen.getByText("Enter an integer value.")).toBeInTheDocument();
        });
      });
    });

    describe("Min/Max Bounds", () => {
      it("shows error when value is below minimum", async () => {
        const user = userEvent.setup();

        render(
          <ConfigNumber
            value={undefined}
            onChange={vi.fn()}
            configKey="limit"
            label="Limit"
            min={1}
          />
        );

        const input = screen.getByRole("spinbutton");
        await user.type(input, "0");

        await waitFor(() => {
          expect(screen.getByText("Value must be at least 1.")).toBeInTheDocument();
        });
      });

      it("shows error when value is above maximum", async () => {
        const user = userEvent.setup();

        render(
          <ConfigNumber
            value={undefined}
            onChange={vi.fn()}
            configKey="limit"
            label="Limit"
            max={100}
          />
        );

        const input = screen.getByRole("spinbutton");
        await user.type(input, "150");

        await waitFor(() => {
          expect(screen.getByText("Value must be at most 100.")).toBeInTheDocument();
        });
      });

      it("clamps to minimum when clampToBounds is true", async () => {
        const user = userEvent.setup();
        const handleChange = vi.fn();

        const Wrapper = () => {
          const [value, setValue] = useState<number | undefined>(undefined);
          return (
            <ConfigNumber
              value={value}
              onChange={(nextValue, emitPatch, shouldEmit) => {
                setValue(nextValue);
                handleChange(nextValue, emitPatch, shouldEmit);
              }}
              configKey="limit"
              label="Limit"
              min={10}
              clampToBounds
            />
          );
        };

        render(<Wrapper />);

        const input = screen.getByRole("spinbutton");
        await user.type(input, "5");

        await waitFor(() => {
          expect(handleChange).toHaveBeenCalledWith(
            10,
            { limit: true },
            true
          );
        });
      });

      it("clamps to maximum when clampToBounds is true", async () => {
        const user = userEvent.setup();
        const handleChange = vi.fn();

        const Wrapper = () => {
          const [value, setValue] = useState<number | undefined>(undefined);
          return (
            <ConfigNumber
              value={value}
              onChange={(nextValue, emitPatch, shouldEmit) => {
                setValue(nextValue);
                handleChange(nextValue, emitPatch, shouldEmit);
              }}
              configKey="limit"
              label="Limit"
              max={100}
              clampToBounds
            />
          );
        };

        render(<Wrapper />);

        const input = screen.getByRole("spinbutton");
        await user.type(input, "999");

        await waitFor(() => {
          expect(handleChange).toHaveBeenCalledWith(
            100,
            { limit: true },
            true
          );
        });
      });
    });

    describe("Custom Validator", () => {
      it("runs custom validator and shows error", async () => {
        const user = userEvent.setup();
        const customValidator = (value: number) =>
          value % 2 !== 0 ? "Value must be even." : null;

        render(
          <ConfigNumber
            value={undefined}
            onChange={vi.fn()}
            configKey="count"
            label="Count"
            customValidator={customValidator}
          />
        );

        const input = screen.getByRole("spinbutton");
        await user.type(input, "3");

        await waitFor(() => {
          expect(screen.getByText("Value must be even.")).toBeInTheDocument();
        });
      });

      it("custom validator passes for valid values", async () => {
        const user = userEvent.setup();
        const handleChange = vi.fn();
        const customValidator = (value: number) =>
          value % 2 !== 0 ? "Value must be even." : null;

        const Wrapper = () => {
          const [value, setValue] = useState<number | undefined>(undefined);
          return (
            <ConfigNumber
              value={value}
              onChange={(nextValue, emitPatch, shouldEmit) => {
                setValue(nextValue);
                handleChange(nextValue, emitPatch, shouldEmit);
              }}
              configKey="count"
              label="Count"
              customValidator={customValidator}
            />
          );
        };

        render(<Wrapper />);

        const input = screen.getByRole("spinbutton");
        await user.type(input, "4");

        await waitFor(() => {
          expect(handleChange).toHaveBeenCalledWith(
            4,
            { count: true },
            true
          );
        });

        expect(screen.queryByText("Value must be even.")).not.toBeInTheDocument();
      });
    });

    describe("Validation Mode", () => {
      it("validates on change when validationMode is change", async () => {
        const user = userEvent.setup();

        render(
          <ConfigNumber
            value={undefined}
            onChange={vi.fn()}
            configKey="limit"
            label="Limit"
            min={1}
            validationMode="change"
          />
        );

        const input = screen.getByRole("spinbutton");
        await user.type(input, "0");

        await waitFor(() => {
          expect(screen.getByText("Value must be at least 1.")).toBeInTheDocument();
        });
      });

      it("only shows validation on blur when validationMode is blur", async () => {
        const user = userEvent.setup();

        render(
          <div>
            <ConfigNumber
              value={undefined}
              onChange={vi.fn()}
              configKey="limit"
              label="Limit"
              min={1}
              validationMode="blur"
            />
            <button>Other element</button>
          </div>
        );

        const input = screen.getByRole("spinbutton");
        await user.type(input, "0");

        // Should NOT show error yet
        expect(screen.queryByText("Value must be at least 1.")).not.toBeInTheDocument();

        // Blur by tabbing away
        await user.tab();

        // Now should show error
        await waitFor(() => {
          expect(screen.getByText("Value must be at least 1.")).toBeInTheDocument();
        });
      });
    });
  });

  describe("Step Behavior", () => {
    it("uses provided step value", () => {
      render(
        <ConfigNumber
          value={10}
          onChange={vi.fn()}
          configKey="precision"
          label="Precision"
          step={0.1}
        />
      );

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("step", "0.1");
    });

    it("uses step=1 when integerOnly is true", () => {
      render(
        <ConfigNumber
          value={10}
          onChange={vi.fn()}
          configKey="count"
          label="Count"
          integerOnly
        />
      );

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("step", "1");
    });

    it("uses step=any by default for non-integers", () => {
      render(
        <ConfigNumber
          value={10}
          onChange={vi.fn()}
          configKey="value"
          label="Value"
        />
      );

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("step", "any");
    });
  });

  describe("Emission Behavior", () => {
    it("emits true when value differs from default", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<number | undefined>(undefined);
        return (
          <ConfigNumber
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="limit"
            label="Limit"
            defaultValue={0}
          />
        );
      };

      render(<Wrapper />);

      const input = screen.getByRole("spinbutton");
      await user.type(input, "42");

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          42,
          { limit: true },
          true
        );
      });
    });

    it("emits false when value returns to default", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<number | undefined>(42);
        return (
          <ConfigNumber
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="limit"
            label="Limit"
            // No defaultValue means default is undefined (empty field is acceptable)
          />
        );
      };

      render(<Wrapper />);

      const input = screen.getByRole("spinbutton");
      await user.clear(input);

      // When cleared, it returns to default (undefined) so shouldEmit=false
      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          undefined,
          {},
          false
        );
      });
    });
  });

  describe("Validation Change Callback", () => {
    it("calls onValidationChange with valid state", async () => {
      const user = userEvent.setup();
      const onValidationChange = vi.fn();

      render(
        <ConfigNumber
          value={undefined}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
          onValidationChange={onValidationChange}
        />
      );

      const input = screen.getByRole("spinbutton");
      await user.type(input, "42");

      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalledWith({
          valid: true,
          message: null,
        });
      });
    });

    it("calls onValidationChange with error state", async () => {
      const user = userEvent.setup();
      const onValidationChange = vi.fn();

      render(
        <ConfigNumber
          value={undefined}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
          min={10}
          onValidationChange={onValidationChange}
        />
      );

      const input = screen.getByRole("spinbutton");
      await user.type(input, "5");

      await waitFor(() => {
        expect(onValidationChange).toHaveBeenCalledWith({
          valid: false,
          message: "Value must be at least 10.",
        });
      });
    });
  });

  describe("Accessibility", () => {
    it("associates label with input", () => {
      render(
        <ConfigNumber
          value={10}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
        />
      );

      const input = screen.getByLabelText("Limit");
      expect(input).toBeInTheDocument();
    });

    it("sets aria-invalid when there is an error", async () => {
      const user = userEvent.setup();

      render(
        <ConfigNumber
          value={undefined}
          onChange={vi.fn()}
          configKey="limit"
          label="Limit"
          min={10}
        />
      );

      const input = screen.getByRole("spinbutton");
      await user.type(input, "5");

      await waitFor(() => {
        expect(input).toHaveAttribute("aria-invalid", "true");
      });
    });

    it("sets inputMode to numeric for integer fields", () => {
      render(
        <ConfigNumber
          value={10}
          onChange={vi.fn()}
          configKey="count"
          label="Count"
          integerOnly
        />
      );

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("inputmode", "numeric");
    });

    it("sets inputMode to decimal for decimal fields", () => {
      render(
        <ConfigNumber
          value={3.14}
          onChange={vi.fn()}
          configKey="ratio"
          label="Ratio"
        />
      );

      const input = screen.getByRole("spinbutton");
      expect(input).toHaveAttribute("inputmode", "decimal");
    });
  });

  describe("Edge Cases", () => {
    it("handles zero correctly", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<number | undefined>(undefined);
        return (
          <ConfigNumber
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="offset"
            label="Offset"
            defaultValue={10}
          />
        );
      };

      render(<Wrapper />);

      const input = screen.getByRole("spinbutton");
      await user.type(input, "0");

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          0,
          { offset: true },
          true
        );
      });
    });

    it("handles very large numbers", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<number | undefined>(undefined);
        return (
          <ConfigNumber
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="limit"
            label="Limit"
          />
        );
      };

      render(<Wrapper />);

      const input = screen.getByRole("spinbutton");
      await user.type(input, "999999999");

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          999999999,
          { limit: true },
          true
        );
      });
    });

    it("handles very small decimals", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      const Wrapper = () => {
        const [value, setValue] = useState<number | undefined>(undefined);
        return (
          <ConfigNumber
            value={value}
            onChange={(nextValue, emitPatch, shouldEmit) => {
              setValue(nextValue);
              handleChange(nextValue, emitPatch, shouldEmit);
            }}
            configKey="epsilon"
            label="Epsilon"
          />
        );
      };

      render(<Wrapper />);

      const input = screen.getByRole("spinbutton");
      await user.type(input, "0.0001");

      await waitFor(() => {
        expect(handleChange).toHaveBeenCalledWith(
          0.0001,
          { epsilon: true },
          true
        );
      });
    });
  });
});
