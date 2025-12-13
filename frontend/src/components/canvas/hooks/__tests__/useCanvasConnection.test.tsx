import { renderHook } from "@testing-library/react";
import type { Connection, Edge, Node } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasConnection,
  type UseCanvasConnectionParams,
} from "../useCanvasConnection";

describe("useCanvasConnection", () => {
  let params: UseCanvasConnectionParams;
  let onAddWire: ReturnType<typeof vi.fn>;
  let onRemoveWire: ReturnType<typeof vi.fn>;
  let onRemoveTool: ReturnType<typeof vi.fn>;
  let onToolSelect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onAddWire = vi.fn();
    onRemoveWire = vi.fn();
    onRemoveTool = vi.fn();
    onToolSelect = vi.fn();

    params = {
      onAddWire,
      onRemoveWire,
      onRemoveTool,
      onToolSelect,
    };
  });

  describe("onConnect", () => {
    it("should add wire when connection is complete", () => {
      const { result } = renderHook(() => useCanvasConnection(params));
      const connection: Connection = {
        source: "tool1",
        target: "tool2",
        sourceHandle: "output-data",
        targetHandle: "input-data",
      };

      result.current.onConnect(connection);

      expect(onAddWire).toHaveBeenCalledWith(
        { tool: "tool1", socket: "data" },
        { tool: "tool2", socket: "data" }
      );
    });

    it("should not add wire if source is missing", () => {
      const { result } = renderHook(() => useCanvasConnection(params));
      const connection = {
        source: null,
        target: "tool2",
        sourceHandle: "output-data",
        targetHandle: "input-data",
      } as unknown as Connection;

      result.current.onConnect(connection);

      expect(onAddWire).not.toHaveBeenCalled();
    });

    it("should not add wire if sourceHandle is missing", () => {
      const { result } = renderHook(() => useCanvasConnection(params));
      const connection = {
        source: "tool1",
        target: "tool2",
        sourceHandle: null,
        targetHandle: "input-data",
      } as unknown as Connection;

      result.current.onConnect(connection);

      expect(onAddWire).not.toHaveBeenCalled();
    });
  });

  describe("onEdgesDelete", () => {
    it("should remove each deleted edge", () => {
      const { result } = renderHook(() => useCanvasConnection(params));
      const edges: Edge[] = [
        { id: "edge1", source: "a", target: "b" } as Edge,
        { id: "edge2", source: "c", target: "d" } as Edge,
      ];

      result.current.onEdgesDelete(edges);

      expect(onRemoveWire).toHaveBeenCalledTimes(2);
      expect(onRemoveWire).toHaveBeenCalledWith("edge1");
      expect(onRemoveWire).toHaveBeenCalledWith("edge2");
    });

    it("should handle empty array", () => {
      const { result } = renderHook(() => useCanvasConnection(params));

      result.current.onEdgesDelete([]);

      expect(onRemoveWire).not.toHaveBeenCalled();
    });
  });

  describe("onNodesDelete", () => {
    it("should remove each deleted node and clear selection", () => {
      const { result } = renderHook(() => useCanvasConnection(params));
      const nodes: Node[] = [
        { id: "node1", position: { x: 0, y: 0 }, data: {} } as Node,
        { id: "node2", position: { x: 0, y: 0 }, data: {} } as Node,
      ];

      result.current.onNodesDelete(nodes);

      expect(onRemoveTool).toHaveBeenCalledTimes(2);
      expect(onRemoveTool).toHaveBeenCalledWith("node1");
      expect(onRemoveTool).toHaveBeenCalledWith("node2");
      expect(onToolSelect).toHaveBeenCalledWith(null);
    });

    it("should clear selection even with empty array", () => {
      const { result } = renderHook(() => useCanvasConnection(params));

      result.current.onNodesDelete([]);

      expect(onRemoveTool).not.toHaveBeenCalled();
      expect(onToolSelect).toHaveBeenCalledWith(null);
    });
  });
});
