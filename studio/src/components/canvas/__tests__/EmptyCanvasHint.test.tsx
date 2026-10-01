import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyCanvasHint } from "../EmptyCanvasHint";

describe("EmptyCanvasHint", () => {
  it("renders a non-interactive hint when the canvas has no tools", () => {
    render(<EmptyCanvasHint toolCount={0} />);
    const hint = screen.getByTestId("empty-canvas-hint");
    expect(hint).toHaveTextContent(/Drag a tool from the palette/);
    expect(hint).toHaveTextContent("Ctrl+O");
    expect(hint.className).toContain("pointer-events-none");
  });

  it("renders nothing once the workflow has tools", () => {
    render(<EmptyCanvasHint toolCount={1} />);
    expect(screen.queryByTestId("empty-canvas-hint")).toBeNull();
  });
});
