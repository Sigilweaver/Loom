import { useUIStore } from "@state/uiStore";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useSnapToGrid } from "../useSnapToGrid";

// NOTE: When React Testing Library dependencies are added, this test will run under jsdom.

describe("useSnapToGrid", () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useUIStore.getState();
    // Set snapToGrid to true for these tests
    if (!store.snapToGrid) {
      store.toggleSnapToGrid();
    }
  });

  it("snaps coordinates when snap is enabled by default", () => {
    const { result } = renderHook(() => useSnapToGrid([20, 20]));
    const { snap } = result.current;
    expect(snap(13, 27)).toEqual({ x: 20, y: 20 });
  });

  it("returns original coordinates after disabling snap", () => {
    const { result } = renderHook(() => useSnapToGrid([20, 20]));
    act(() => useUIStore.getState().toggleSnapToGrid()); // now disabled
    const { snap } = result.current;
    expect(snap(13, 27)).toEqual({ x: 13, y: 27 });
  });
});
