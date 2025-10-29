import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import {
  alignHorizontally,
  alignVertically,
  distributeHorizontally,
  distributeVertically,
  type SnapFn,
} from "../alignDistribute";

// Identity snap function (no snapping)
const noSnap: SnapFn = (x, y) => ({ x, y });

// Grid snap function (snap to 10px grid)
const gridSnap: SnapFn = (x, y) => ({
  x: Math.round(x / 10) * 10,
  y: Math.round(y / 10) * 10,
});

// Helper to create a minimal ReactFlow node
function createNode(id: string, x: number, y: number, selected = true): Node {
  return {
    id,
    type: "default",
    position: { x, y },
    data: {},
    selected,
  } as Node;
}

describe("alignDistribute utilities", () => {
  describe("alignHorizontally", () => {
    it("should align selected nodes to average Y position", () => {
      const nodes = [
        createNode("1", 0, 0),
        createNode("2", 100, 50),
        createNode("3", 200, 100),
      ];

      const updates = alignHorizontally(nodes, noSnap);

      // Average Y = (0 + 50 + 100) / 3 = 50
      expect(updates).toHaveLength(3);
      expect(updates[0]).toEqual({ id: "1", x: 0, y: 50 });
      expect(updates[1]).toEqual({ id: "2", x: 100, y: 50 });
      expect(updates[2]).toEqual({ id: "3", x: 200, y: 50 });
    });

    it("should only process selected nodes", () => {
      const nodes = [
        createNode("1", 0, 0, true),
        createNode("2", 100, 50, true),
        createNode("3", 200, 100, false), // Not selected
      ];

      const updates = alignHorizontally(nodes, noSnap);

      // Average Y = (0 + 50) / 2 = 25
      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({ id: "1", x: 0, y: 25 });
      expect(updates[1]).toEqual({ id: "2", x: 100, y: 25 });
    });

    it("should return empty array if less than 2 selected nodes", () => {
      const nodes = [createNode("1", 0, 0)];
      expect(alignHorizontally(nodes, noSnap)).toEqual([]);
      expect(alignHorizontally([], noSnap)).toEqual([]);
    });

    it("should apply snap function to results", () => {
      const nodes = [createNode("1", 0, 7), createNode("2", 100, 13)];

      const updates = alignHorizontally(nodes, gridSnap);

      // Average Y = (7 + 13) / 2 = 10, snapped to 10
      expect(updates[0]).toEqual({ id: "1", x: 0, y: 10 });
      expect(updates[1]).toEqual({ id: "2", x: 100, y: 10 });
    });

    it("should preserve X positions", () => {
      const nodes = [createNode("1", 25, 0), createNode("2", 175, 100)];

      const updates = alignHorizontally(nodes, noSnap);

      expect(updates[0]?.x).toBe(25);
      expect(updates[1]?.x).toBe(175);
    });
  });

  describe("alignVertically", () => {
    it("should align selected nodes to average X position", () => {
      const nodes = [
        createNode("1", 0, 0),
        createNode("2", 50, 100),
        createNode("3", 100, 200),
      ];

      const updates = alignVertically(nodes, noSnap);

      // Average X = (0 + 50 + 100) / 3 = 50
      expect(updates).toHaveLength(3);
      expect(updates[0]).toEqual({ id: "1", x: 50, y: 0 });
      expect(updates[1]).toEqual({ id: "2", x: 50, y: 100 });
      expect(updates[2]).toEqual({ id: "3", x: 50, y: 200 });
    });

    it("should only process selected nodes", () => {
      const nodes = [
        createNode("1", 0, 0, true),
        createNode("2", 50, 100, true),
        createNode("3", 100, 200, false), // Not selected
      ];

      const updates = alignVertically(nodes, noSnap);

      // Average X = (0 + 50) / 2 = 25
      expect(updates).toHaveLength(2);
      expect(updates[0]).toEqual({ id: "1", x: 25, y: 0 });
      expect(updates[1]).toEqual({ id: "2", x: 25, y: 100 });
    });

    it("should return empty array if less than 2 selected nodes", () => {
      const nodes = [createNode("1", 0, 0)];
      expect(alignVertically(nodes, noSnap)).toEqual([]);
      expect(alignVertically([], noSnap)).toEqual([]);
    });

    it("should apply snap function to results", () => {
      const nodes = [createNode("1", 7, 0), createNode("2", 13, 100)];

      const updates = alignVertically(nodes, gridSnap);

      // Average X = (7 + 13) / 2 = 10, snapped to 10
      expect(updates[0]).toEqual({ id: "1", x: 10, y: 0 });
      expect(updates[1]).toEqual({ id: "2", x: 10, y: 100 });
    });

    it("should preserve Y positions", () => {
      const nodes = [createNode("1", 0, 25), createNode("2", 100, 175)];

      const updates = alignVertically(nodes, noSnap);

      expect(updates[0]?.y).toBe(25);
      expect(updates[1]?.y).toBe(175);
    });
  });

  describe("distributeHorizontally", () => {
    it("should distribute nodes evenly along X axis", () => {
      const nodes = [
        createNode("1", 0, 0),
        createNode("2", 25, 0), // Will be moved to 50
        createNode("3", 75, 0), // Will stay at 100 (max)
      ];

      const updates = distributeHorizontally(nodes, noSnap);

      // Min X = 0, Max X = 75, step = 75 / 2 = 37.5
      expect(updates).toHaveLength(3);
      expect(updates[0]).toEqual({ id: "1", x: 0, y: 0 });
      expect(updates[1]).toEqual({ id: "2", x: 37.5, y: 0 });
      expect(updates[2]).toEqual({ id: "3", x: 75, y: 0 });
    });

    it("should return empty array if less than 3 selected nodes", () => {
      const nodes = [createNode("1", 0, 0), createNode("2", 100, 0)];
      expect(distributeHorizontally(nodes, noSnap)).toEqual([]);
      expect(distributeHorizontally([createNode("1", 0, 0)], noSnap)).toEqual(
        []
      );
      expect(distributeHorizontally([], noSnap)).toEqual([]);
    });

    it("should sort nodes by X position before distributing", () => {
      // Create nodes in random order
      const nodes = [
        createNode("middle", 50, 0),
        createNode("right", 100, 0),
        createNode("left", 0, 0),
      ];

      const updates = distributeHorizontally(nodes, noSnap);

      // Should distribute left -> middle -> right
      const leftUpdate = updates.find((u) => u.id === "left");
      const middleUpdate = updates.find((u) => u.id === "middle");
      const rightUpdate = updates.find((u) => u.id === "right");

      expect(leftUpdate?.x).toBe(0);
      expect(middleUpdate?.x).toBe(50);
      expect(rightUpdate?.x).toBe(100);
    });

    it("should preserve Y positions", () => {
      const nodes = [
        createNode("1", 0, 10),
        createNode("2", 50, 20),
        createNode("3", 100, 30),
      ];

      const updates = distributeHorizontally(nodes, noSnap);

      expect(updates[0]?.y).toBe(10);
      expect(updates[1]?.y).toBe(20);
      expect(updates[2]?.y).toBe(30);
    });

    it("should apply snap function to results", () => {
      const nodes = [
        createNode("1", 0, 0),
        createNode("2", 47, 0), // Would be 50, snapped to 50
        createNode("3", 100, 0),
      ];

      const updates = distributeHorizontally(nodes, gridSnap);

      expect(updates[1]?.x).toBe(50); // Snapped to grid
    });

    it("should only process selected nodes", () => {
      const nodes = [
        createNode("1", 0, 0, true),
        createNode("2", 50, 0, false), // Not selected
        createNode("3", 100, 0, true),
        createNode("4", 200, 0, true),
      ];

      const updates = distributeHorizontally(nodes, noSnap);

      // Should only distribute selected nodes (1, 3, 4)
      expect(updates).toHaveLength(3);
    });
  });

  describe("distributeVertically", () => {
    it("should distribute nodes evenly along Y axis", () => {
      const nodes = [
        createNode("1", 0, 0),
        createNode("2", 0, 25), // Will be moved to 50
        createNode("3", 0, 100),
      ];

      const updates = distributeVertically(nodes, noSnap);

      // Min Y = 0, Max Y = 100, step = 100 / 2 = 50
      expect(updates).toHaveLength(3);
      expect(updates[0]).toEqual({ id: "1", x: 0, y: 0 });
      expect(updates[1]).toEqual({ id: "2", x: 0, y: 50 });
      expect(updates[2]).toEqual({ id: "3", x: 0, y: 100 });
    });

    it("should return empty array if less than 3 selected nodes", () => {
      const nodes = [createNode("1", 0, 0), createNode("2", 0, 100)];
      expect(distributeVertically(nodes, noSnap)).toEqual([]);
      expect(distributeVertically([createNode("1", 0, 0)], noSnap)).toEqual([]);
      expect(distributeVertically([], noSnap)).toEqual([]);
    });

    it("should sort nodes by Y position before distributing", () => {
      // Create nodes in random order
      const nodes = [
        createNode("middle", 0, 50),
        createNode("bottom", 0, 100),
        createNode("top", 0, 0),
      ];

      const updates = distributeVertically(nodes, noSnap);

      // Should distribute top -> middle -> bottom
      const topUpdate = updates.find((u) => u.id === "top");
      const middleUpdate = updates.find((u) => u.id === "middle");
      const bottomUpdate = updates.find((u) => u.id === "bottom");

      expect(topUpdate?.y).toBe(0);
      expect(middleUpdate?.y).toBe(50);
      expect(bottomUpdate?.y).toBe(100);
    });

    it("should preserve X positions", () => {
      const nodes = [
        createNode("1", 10, 0),
        createNode("2", 20, 50),
        createNode("3", 30, 100),
      ];

      const updates = distributeVertically(nodes, noSnap);

      expect(updates[0]?.x).toBe(10);
      expect(updates[1]?.x).toBe(20);
      expect(updates[2]?.x).toBe(30);
    });

    it("should apply snap function to results", () => {
      const nodes = [
        createNode("1", 0, 0),
        createNode("2", 0, 47), // Would be 50, snapped to 50
        createNode("3", 0, 100),
      ];

      const updates = distributeVertically(nodes, gridSnap);

      expect(updates[1]?.y).toBe(50); // Snapped to grid
    });

    it("should only process selected nodes", () => {
      const nodes = [
        createNode("1", 0, 0, true),
        createNode("2", 0, 50, false), // Not selected
        createNode("3", 0, 100, true),
        createNode("4", 0, 200, true),
      ];

      const updates = distributeVertically(nodes, noSnap);

      // Should only distribute selected nodes (1, 3, 4)
      expect(updates).toHaveLength(3);
    });
  });

  describe("edge cases", () => {
    it("should handle nodes at the same position", () => {
      const nodes = [
        createNode("1", 50, 50),
        createNode("2", 50, 50),
        createNode("3", 50, 50),
      ];

      const hUpdates = distributeHorizontally(nodes, noSnap);
      const vUpdates = distributeVertically(nodes, noSnap);

      // All nodes at same X, step = 0
      expect(hUpdates[0]?.x).toBe(50);
      expect(hUpdates[1]?.x).toBe(50);
      expect(hUpdates[2]?.x).toBe(50);

      // All nodes at same Y, step = 0
      expect(vUpdates[0]?.y).toBe(50);
      expect(vUpdates[1]?.y).toBe(50);
      expect(vUpdates[2]?.y).toBe(50);
    });

    it("should handle negative positions", () => {
      const nodes = [
        createNode("1", -100, -100),
        createNode("2", 0, 0),
        createNode("3", 100, 100),
      ];

      const hAlign = alignHorizontally(nodes, noSnap);
      const vAlign = alignVertically(nodes, noSnap);

      // Should work correctly with negative positions
      expect(hAlign[0]?.y).toBe(0); // Average Y
      expect(vAlign[0]?.x).toBe(0); // Average X
    });

    it("should handle fractional positions", () => {
      const nodes = [
        createNode("1", 0.5, 0.5),
        createNode("2", 1.5, 1.5),
        createNode("3", 2.5, 2.5),
      ];

      const updates = distributeHorizontally(nodes, noSnap);

      // Should handle fractional math correctly
      expect(updates[0]?.x).toBe(0.5);
      expect(updates[1]?.x).toBe(1.5);
      expect(updates[2]?.x).toBe(2.5);
    });
  });
});
