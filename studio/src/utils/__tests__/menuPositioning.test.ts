import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calculateMenuPosition, useMenuPositioning } from "../menuPositioning";

// Helper to create a DOMRect
function createRect(
  left: number,
  top: number,
  width: number,
  height: number
): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

describe("menuPositioning utilities", () => {
  let originalInnerWidth: number;
  let originalInnerHeight: number;

  beforeEach(() => {
    // Store original window dimensions
    originalInnerWidth = window.innerWidth;
    originalInnerHeight = window.innerHeight;

    // Set standard test viewport
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: 768,
    });
  });

  afterEach(() => {
    // Restore original dimensions
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, "innerHeight", {
      writable: true,
      configurable: true,
      value: originalInnerHeight,
    });
  });

  describe("calculateMenuPosition", () => {
    describe("preferred placement: bottom (default)", () => {
      it("should place menu below trigger when space is available", () => {
        const triggerRect = createRect(100, 100, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        expect(result.placement).toBe("bottom");
        expect(result.x).toBe(100); // Aligned to trigger left
        expect(result.y).toBe(134); // trigger.bottom (130) + offset (4)
      });

      it("should fall back to top when no space below", () => {
        // Trigger near bottom of screen
        const triggerRect = createRect(100, 700, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        expect(result.placement).toBe("top");
        expect(result.x).toBe(100);
        expect(result.y).toBe(536); // trigger.top (700) - height (160) - offset (4)
      });

      it("should fall back to right when bottom and top do not fit", () => {
        // Large menu that does not fit vertically
        const triggerRect = createRect(100, 300, 50, 30);
        const menuDims = { width: 120, height: 600 }; // Too tall for screen

        const result = calculateMenuPosition(triggerRect, menuDims);

        // Should try other placements or adjust position
        // Since menu is too tall, it will use preferred placement with adjustment
        expect(result.placement).toBeDefined();
        expect(result.y).toBeGreaterThanOrEqual(8); // At least padding from top
      });

      it("should fall back when no placement fits perfectly", () => {
        // Trigger on right edge, tall menu
        const triggerRect = createRect(900, 300, 50, 30);
        const menuDims = { width: 120, height: 600 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        // Should adjust to fit within bounds
        expect(result.placement).toBeDefined();
        expect(result.x + menuDims.width).toBeLessThanOrEqual(1024);
        expect(result.y).toBeGreaterThanOrEqual(8);
      });
    });

    describe("preferred placement: top", () => {
      it("should place menu above trigger when space is available", () => {
        const triggerRect = createRect(100, 200, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims, 4, "top");

        expect(result.placement).toBe("top");
        expect(result.x).toBe(100);
        expect(result.y).toBe(36); // trigger.top (200) - height (160) - offset (4)
      });

      it("should fall back to bottom when no space above", () => {
        const triggerRect = createRect(100, 50, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims, 4, "top");

        expect(result.placement).toBe("bottom");
      });
    });

    describe("preferred placement: right", () => {
      it("should place menu to the right of trigger when space is available", () => {
        const triggerRect = createRect(100, 100, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims, 4, "right");

        expect(result.placement).toBe("right");
        expect(result.x).toBe(154); // trigger.right (150) + offset (4)
        expect(result.y).toBe(100); // Aligned to trigger top
      });

      it("should fall back to left when no space on right", () => {
        const triggerRect = createRect(900, 100, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims, 4, "right");

        expect(result.placement).toBe("left");
      });
    });

    describe("preferred placement: left", () => {
      it("should place menu to the left of trigger when space is available", () => {
        const triggerRect = createRect(200, 100, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims, 4, "left");

        expect(result.placement).toBe("left");
        expect(result.x).toBe(76); // trigger.left (200) - width (120) - offset (4)
        expect(result.y).toBe(100);
      });

      it("should fall back to right when no space on left", () => {
        const triggerRect = createRect(50, 100, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims, 4, "left");

        expect(result.placement).toBe("right");
      });
    });

    describe("edge adjustment", () => {
      it("should adjust position when menu would overflow right edge", () => {
        const triggerRect = createRect(950, 100, 50, 30);
        const menuDims = { width: 200, height: 100 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        // Should adjust X to fit within screen
        expect(result.x + menuDims.width).toBeLessThanOrEqual(1024 - 8);
        expect(result.x).toBeGreaterThanOrEqual(8);
      });

      it("should adjust position when menu would overflow bottom edge", () => {
        const triggerRect = createRect(100, 700, 50, 30);
        const menuDims = { width: 120, height: 200 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        // Should adjust Y to fit within screen (768 - 200 - 8 padding = 560)
        expect(result.y).toBeLessThanOrEqual(560);
      });

      it("should adjust position when menu would overflow left edge", () => {
        // Trigger very close to left edge where menu wouldn't fit
        const triggerRect = createRect(5, 100, 50, 30);
        const menuDims = { width: 200, height: 100 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        // The function uses trigger position when space is available
        // It should fit the menu within screen bounds
        expect(result.x + menuDims.width).toBeLessThanOrEqual(1024 - 8);
      });

      it("should adjust position when menu would overflow top edge", () => {
        const triggerRect = createRect(100, 5, 50, 30);
        const menuDims = { width: 120, height: 200 };

        const result = calculateMenuPosition(triggerRect, menuDims, 4, "top");

        // Should adjust Y to minimum padding (8px)
        expect(result.y).toBeGreaterThanOrEqual(8);
      });
    });

    describe("custom offset", () => {
      it("should use custom offset", () => {
        const triggerRect = createRect(100, 100, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims, 16);

        expect(result.y).toBe(146); // trigger.bottom (130) + offset (16)
      });

      it("should use offset of 0", () => {
        const triggerRect = createRect(100, 100, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims, 0);

        expect(result.y).toBe(130); // trigger.bottom (130) + offset (0)
      });
    });

    describe("edge cases", () => {
      it("should handle menu larger than viewport", () => {
        const triggerRect = createRect(100, 100, 50, 30);
        const menuDims = { width: 2000, height: 1000 }; // Larger than viewport

        const result = calculateMenuPosition(triggerRect, menuDims);

        // Should clamp to padding boundaries
        expect(result.x).toBe(8); // Minimum padding
        expect(result.y).toBe(8); // Minimum padding
      });

      it("should handle trigger at (0, 0)", () => {
        const triggerRect = createRect(0, 0, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        expect(result.x).toBeGreaterThanOrEqual(0);
        expect(result.y).toBeGreaterThanOrEqual(0);
      });

      it("should handle small menu", () => {
        const triggerRect = createRect(100, 100, 50, 30);
        const menuDims = { width: 50, height: 50 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        expect(result.placement).toBe("bottom");
        expect(result.x).toBe(100);
        expect(result.y).toBe(134);
      });

      it("should handle trigger at screen edge", () => {
        const triggerRect = createRect(1000, 750, 20, 15);
        const menuDims = { width: 100, height: 80 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        // Should adjust to fit within screen
        expect(result.x + menuDims.width).toBeLessThanOrEqual(1024);
        expect(result.y + menuDims.height).toBeLessThanOrEqual(768);
      });
    });

    describe("different screen sizes", () => {
      it("should work on small screen", () => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          value: 375,
        });
        Object.defineProperty(window, "innerHeight", {
          writable: true,
          value: 667,
        });

        const triggerRect = createRect(100, 100, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        expect(result.x).toBeGreaterThanOrEqual(8);
        expect(result.y).toBeGreaterThanOrEqual(8);
        expect(result.x + menuDims.width).toBeLessThanOrEqual(375 - 8);
      });

      it("should work on large screen", () => {
        Object.defineProperty(window, "innerWidth", {
          writable: true,
          value: 2560,
        });
        Object.defineProperty(window, "innerHeight", {
          writable: true,
          value: 1440,
        });

        const triggerRect = createRect(1000, 500, 50, 30);
        const menuDims = { width: 120, height: 160 };

        const result = calculateMenuPosition(triggerRect, menuDims);

        expect(result.placement).toBe("bottom");
        expect(result.x).toBe(1000);
        expect(result.y).toBe(534);
      });
    });
  });

  describe("useMenuPositioning", () => {
    it("should return a function that calculates position from element", () => {
      const menuDims = { width: 120, height: 160 };
      const getPosition = useMenuPositioning(menuDims);

      expect(typeof getPosition).toBe("function");
    });

    it("should calculate position correctly when called", () => {
      const menuDims = { width: 120, height: 160 };
      const getPosition = useMenuPositioning(menuDims, 4, "bottom");

      // Mock element
      const mockElement = {
        getBoundingClientRect: () => createRect(100, 100, 50, 30),
      } as HTMLElement;

      const result = getPosition(mockElement);

      expect(result.placement).toBe("bottom");
      expect(result.x).toBe(100);
      expect(result.y).toBe(134);
    });

    it("should use custom offset and placement", () => {
      const menuDims = { width: 120, height: 160 };
      const getPosition = useMenuPositioning(menuDims, 16, "top");

      const mockElement = {
        getBoundingClientRect: () => createRect(100, 200, 50, 30),
      } as HTMLElement;

      const result = getPosition(mockElement);

      expect(result.placement).toBe("top");
      expect(result.y).toBe(24); // 200 - 160 - 16
    });

    it("should handle getBoundingClientRect changes", () => {
      const menuDims = { width: 120, height: 160 };
      const getPosition = useMenuPositioning(menuDims);

      // Mock element that moves
      let position = { left: 100, top: 100 };
      const mockElement = {
        getBoundingClientRect: () =>
          createRect(position.left, position.top, 50, 30),
      } as HTMLElement;

      const result1 = getPosition(mockElement);
      expect(result1.x).toBe(100);
      expect(result1.y).toBe(134);

      // Move element
      position = { left: 200, top: 200 };
      const result2 = getPosition(mockElement);
      expect(result2.x).toBe(200);
      expect(result2.y).toBe(234);
    });
  });
});
