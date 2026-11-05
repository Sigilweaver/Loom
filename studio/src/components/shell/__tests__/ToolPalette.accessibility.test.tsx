import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import ToolPalette, { TOOL_TOUCH_DROP_EVENT, type ToolTouchDropDetail } from "../ToolPalette";

function Wrapper({ children }: { children: React.ReactNode }) {
  // ToolPalette now uses uiStore internally, no props needed
  return <div>{children}</div>;
}

describe("ToolPalette accessibility", () => {
  it("favorite toggle buttons are keyboard accessible", async () => {
    render(
      <Wrapper>
        <ToolPalette />
      </Wrapper>
    );

    // Find favorite toggle buttons on tool items (not category headers)
    const favoriteButtons = screen.getAllByRole("button", { name: /from favorites|to favorites/i });
    expect(favoriteButtons.length).toBeGreaterThan(0);
    const favoriteButton = favoriteButtons[0]!;

    // Button gains focus via keyboard navigation
    favoriteButton.focus();
    expect(document.activeElement).toBe(favoriteButton);

    // Verify it has proper accessibility attributes
    expect(favoriteButton).toHaveAttribute("aria-label");
  });

  it("renders all category sections", () => {
    render(
      <Wrapper>
        <ToolPalette />
      </Wrapper>
    );

    // Check that all category headers are present (now as collapsible buttons)
    // Category headers have aria-expanded attribute
    const categoryButtons = screen.getAllByRole("button", { expanded: true });
    expect(categoryButtons.length).toBeGreaterThanOrEqual(5); // 5 categories

    // Check category names appear
    expect(screen.getAllByText("Favorites").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Connect").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Compute").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Reshape").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Combine").length).toBeGreaterThanOrEqual(1);
  });

  it("adds a tool to the canvas with Enter or double-click", () => {
    const dropTarget = document.createElement("div");
    dropTarget.setAttribute("data-canvas-drop-target", "");
    document.body.appendChild(dropTarget);
    const drops: ToolTouchDropDetail[] = [];
    const listener = (e: Event) => drops.push((e as CustomEvent<ToolTouchDropDetail>).detail);
    document.addEventListener(TOOL_TOUCH_DROP_EVENT, listener);

    render(
      <Wrapper>
        <ToolPalette />
      </Wrapper>
    );

    const tiles = screen.getAllByRole("button", { name: /^Add .+ to the canvas$/ });
    expect(tiles.length).toBeGreaterThan(0);
    const tile = tiles[0]!;
    expect(tile).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(tile, { key: "Enter" });
    fireEvent.doubleClick(tile);

    expect(drops).toHaveLength(2);
    expect(drops[0]!.toolType).toBeTruthy();

    document.removeEventListener(TOOL_TOUCH_DROP_EVENT, listener);
    dropTarget.remove();
  });
});
