import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import ToolPalette from "../ToolPalette";
import { useUIStore } from "@state/uiStore";
import { DEFAULT_FAVORITE_TOOLS, TOOL_DEFINITIONS } from "@data/tools";

describe("ToolPalette favorites", () => {
  beforeEach(() => {
    useUIStore.setState({ favoriteTools: [...DEFAULT_FAVORITE_TOOLS], collapsedCategories: [] });
  });

  it("lists each favorite tool exactly once", () => {
    render(<ToolPalette />);
    for (const tool of TOOL_DEFINITIONS.filter((t) => DEFAULT_FAVORITE_TOOLS.includes(t.type))) {
      expect(screen.getAllByLabelText(`Remove ${tool.name} from favorites`)).toHaveLength(1);
    }
  });

  it("lists each non-favorite tool exactly once", () => {
    render(<ToolPalette />);
    for (const tool of TOOL_DEFINITIONS.filter((t) => !DEFAULT_FAVORITE_TOOLS.includes(t.type))) {
      expect(screen.getAllByLabelText(`Add ${tool.name} to favorites`)).toHaveLength(1);
    }
  });

  it("shows a tool in its own category once it is not a favorite", () => {
    useUIStore.setState({ favoriteTools: [] });
    render(<ToolPalette />);
    expect(screen.getByText("Click the star on any tool to add it here.")).toBeTruthy();
    expect(screen.getAllByLabelText("Add Filter to favorites")).toHaveLength(1);
  });
});
