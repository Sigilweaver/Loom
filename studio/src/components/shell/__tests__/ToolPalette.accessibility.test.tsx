import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";
import ToolPalette from "../ToolPalette";

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
});
