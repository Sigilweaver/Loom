import { render, screen } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import ToolPalette from "../ToolPalette";
import { useSettingsStore } from "@state/settingsStore";
import { DEFAULT_SETTINGS } from "../../../types/settings";

describe("ToolPalette blocking indicators", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, loaded: true });
  });

  it("renders blocking indicators when showBlockingIndicators is true", () => {
    useSettingsStore.setState({
      ui: { ...DEFAULT_SETTINGS.ui, showBlockingIndicators: true },
    });

    render(<ToolPalette />);

    // 5 blocking tools (Sort, Join, Aggregate, Pivot, Unpivot) across categories,
    // plus duplicates for any that also appear in favorites (Sort, Join, Aggregate).
    const blockingIcons = screen.getAllByLabelText("Blocking operation");
    expect(blockingIcons.length).toBeGreaterThanOrEqual(5);
  });

  it("hides blocking indicators when showBlockingIndicators is false", () => {
    useSettingsStore.setState({
      ui: { ...DEFAULT_SETTINGS.ui, showBlockingIndicators: false },
    });

    render(<ToolPalette />);

    const blockingIcons = screen.queryAllByLabelText("Blocking operation");
    expect(blockingIcons).toHaveLength(0);
  });

  it("shows blocking explanation in tool tooltip when indicators enabled", () => {
    useSettingsStore.setState({
      ui: { ...DEFAULT_SETTINGS.ui, showBlockingIndicators: true },
    });

    render(<ToolPalette />);

    // Sort is a blocking tool — its labels should include the blocking explanation.
    // Multiple matches expected (favorites + category section).
    const sortLabels = screen.getAllByTitle("Sort (blocking operation — breaks lazy evaluation)");
    expect(sortLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("shows plain tool name in tooltip when indicators disabled", () => {
    useSettingsStore.setState({
      ui: { ...DEFAULT_SETTINGS.ui, showBlockingIndicators: false },
    });

    render(<ToolPalette />);

    // Sort labels should just show the name, not the blocking explanation.
    // Multiple matches expected (favorites + category section).
    const sortLabels = screen.getAllByTitle("Sort");
    expect(sortLabels.length).toBeGreaterThanOrEqual(1);

    // No blocking tooltips should exist
    const blockingTooltips = screen.queryAllByTitle(/blocking operation/);
    expect(blockingTooltips).toHaveLength(0);
  });
});
