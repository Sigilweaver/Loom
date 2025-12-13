import { renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useCanvasAlignment,
  type UseCanvasAlignmentParams,
} from "../useCanvasAlignment";

// Mock align/distribute utilities
vi.mock("@utils/alignDistribute", () => ({
  alignHorizontally: vi.fn(() => []),
  alignVertically: vi.fn(() => []),
  distributeHorizontally: vi.fn(() => []),
  distributeVertically: vi.fn(() => []),
}));

import {
  alignHorizontally as doAlignH,
  alignVertically as doAlignV,
  distributeHorizontally as doDistH,
  distributeVertically as doDistV,
} from "@utils/alignDistribute";

describe("useCanvasAlignment", () => {
  let params: UseCanvasAlignmentParams;
  let getNodes: () => Node[];
  let snap: (x: number, y: number) => { x: number; y: number };
  let onToolMove: ReturnType<typeof vi.fn>;
  let onBeginTransaction: ReturnType<typeof vi.fn>;
  let onCommitTransaction: ReturnType<typeof vi.fn>;
  let mockNodes: Node[];

  beforeEach(() => {
    mockNodes = [
      { id: "n1", position: { x: 0, y: 0 }, selected: true } as Node,
      { id: "n2", position: { x: 100, y: 100 }, selected: true } as Node,
    ];
    getNodes = vi.fn(() => mockNodes);
    snap = vi.fn((x, y) => ({ x, y }));
    onToolMove = vi.fn();
    onBeginTransaction = vi.fn();
    onCommitTransaction = vi.fn();

    params = {
      getNodes,
      snap,
      onToolMove,
      onBeginTransaction,
      onCommitTransaction,
    };

    vi.clearAllMocks();
  });

  describe("alignHorizontally", () => {
    it("should call align utility and apply positions", () => {
      vi.mocked(doAlignH).mockReturnValue([
        { id: "n1", x: 50, y: 0 },
        { id: "n2", x: 50, y: 100 },
      ]);

      const { result } = renderHook(() => useCanvasAlignment(params));
      result.current.alignHorizontally();

      expect(doAlignH).toHaveBeenCalledWith(mockNodes, snap);
      expect(onBeginTransaction).toHaveBeenCalled();
      expect(onToolMove).toHaveBeenCalledWith("n1", 50, 0);
      expect(onToolMove).toHaveBeenCalledWith("n2", 50, 100);
      expect(onCommitTransaction).toHaveBeenCalled();
    });

    it("should not call handlers if no updates", () => {
      vi.mocked(doAlignH).mockReturnValue([]);

      const { result } = renderHook(() => useCanvasAlignment(params));
      result.current.alignHorizontally();

      expect(onBeginTransaction).not.toHaveBeenCalled();
      expect(onToolMove).not.toHaveBeenCalled();
      expect(onCommitTransaction).not.toHaveBeenCalled();
    });
  });

  describe("alignVertically", () => {
    it("should call align utility and apply positions", () => {
      vi.mocked(doAlignV).mockReturnValue([
        { id: "n1", x: 0, y: 50 },
        { id: "n2", x: 100, y: 50 },
      ]);

      const { result } = renderHook(() => useCanvasAlignment(params));
      result.current.alignVertically();

      expect(doAlignV).toHaveBeenCalledWith(mockNodes, snap);
      expect(onBeginTransaction).toHaveBeenCalled();
      expect(onToolMove).toHaveBeenCalledWith("n1", 0, 50);
      expect(onToolMove).toHaveBeenCalledWith("n2", 100, 50);
      expect(onCommitTransaction).toHaveBeenCalled();
    });
  });

  describe("distributeHorizontally", () => {
    it("should call distribute utility and apply positions", () => {
      vi.mocked(doDistH).mockReturnValue([
        { id: "n1", x: 0, y: 0 },
        { id: "n2", x: 100, y: 100 },
      ]);

      const { result } = renderHook(() => useCanvasAlignment(params));
      result.current.distributeHorizontally();

      expect(doDistH).toHaveBeenCalledWith(mockNodes, snap);
      expect(onBeginTransaction).toHaveBeenCalled();
      expect(onCommitTransaction).toHaveBeenCalled();
    });
  });

  describe("distributeVertically", () => {
    it("should call distribute utility and apply positions", () => {
      vi.mocked(doDistV).mockReturnValue([
        { id: "n1", x: 0, y: 0 },
        { id: "n2", x: 100, y: 100 },
      ]);

      const { result } = renderHook(() => useCanvasAlignment(params));
      result.current.distributeVertically();

      expect(doDistV).toHaveBeenCalledWith(mockNodes, snap);
      expect(onBeginTransaction).toHaveBeenCalled();
      expect(onCommitTransaction).toHaveBeenCalled();
    });
  });
});
