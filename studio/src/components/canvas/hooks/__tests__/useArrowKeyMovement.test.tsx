import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useArrowKeyMovement } from '../useArrowKeyMovement';
import type { Node } from '@xyflow/react';

describe('useArrowKeyMovement', () => {
  const mockNode1: Node = {
    id: 'node1',
    type: 'workflow',
    position: { x: 100, y: 200 },
    data: {},
    selected: true,
    dragging: false,
    selectable: true,
    deletable: true
  };

  const mockNode2: Node = {
    id: 'node2',
    type: 'workflow', 
    position: { x: 300, y: 400 },
    data: {},
    selected: true,
    dragging: false,
    selectable: true,
    deletable: true
  };

  const mockNode3: Node = {
    id: 'node3',
    type: 'workflow',
    position: { x: 500, y: 600 },
    data: {},
    selected: false,
    dragging: false,
    selectable: true,
    deletable: true
  };

  const createMockEvent = (key: string, shiftKey = false): React.KeyboardEvent => ({
    key,
    shiftKey,
    preventDefault: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  it('should move single selected node by grid increment', () => {
    const mockGetNodes = vi.fn(() => [mockNode1, mockNode3]);
    const mockSnap = vi.fn((x, y) => ({ x, y }));
    const mockOnToolMove = vi.fn();
    const mockOnBeginTransaction = vi.fn();
    const mockOnCommitTransaction = vi.fn();

    const { result } = renderHook(() => useArrowKeyMovement({
      getNodes: mockGetNodes,
      snap: mockSnap,
      onToolMove: mockOnToolMove,
      onBeginTransaction: mockOnBeginTransaction,
      onCommitTransaction: mockOnCommitTransaction,
      gridSize: [20, 20]
    }));

    const moveHandler = result.current;
    const event = createMockEvent('ArrowRight');
    const handled = moveHandler(event);

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockOnBeginTransaction).toHaveBeenCalled();
    expect(mockOnCommitTransaction).toHaveBeenCalled();
    expect(mockOnToolMove).toHaveBeenCalledWith('node1', 120, 200); // 100 + 20
  });

  it('should move multiple selected nodes maintaining relative positions', () => {
    const mockGetNodes = vi.fn(() => [mockNode1, mockNode2, mockNode3]);
    const mockSnap = vi.fn((x, y) => ({ x, y }));
    const mockOnToolMove = vi.fn();
    const mockOnBeginTransaction = vi.fn();
    const mockOnCommitTransaction = vi.fn();

    const { result } = renderHook(() => useArrowKeyMovement({
      getNodes: mockGetNodes,
      snap: mockSnap,
      onToolMove: mockOnToolMove,
      onBeginTransaction: mockOnBeginTransaction,
      onCommitTransaction: mockOnCommitTransaction,
      gridSize: [20, 20]
    }));

    const moveHandler = result.current;
    const event = createMockEvent('ArrowUp');
    const handled = moveHandler(event);

    expect(handled).toBe(true);
    expect(mockOnToolMove).toHaveBeenCalledTimes(2); // Only selected nodes
    expect(mockOnToolMove).toHaveBeenCalledWith('node1', 100, 180); // 200 - 20
    expect(mockOnToolMove).toHaveBeenCalledWith('node2', 300, 380); // 400 - 20
  });

  it('should move by larger increment when Shift is held', () => {
    const mockGetNodes = vi.fn(() => [mockNode1]);
    const mockSnap = vi.fn((x, y) => ({ x, y }));
    const mockOnToolMove = vi.fn();

    const { result } = renderHook(() => useArrowKeyMovement({
      getNodes: mockGetNodes,
      snap: mockSnap,
      onToolMove: mockOnToolMove,
      gridSize: [20, 20]
    }));

    const moveHandler = result.current;
    const event = createMockEvent('ArrowDown', true); // Shift + Arrow
    const handled = moveHandler(event);

    expect(handled).toBe(true);
    expect(mockOnToolMove).toHaveBeenCalledWith('node1', 100, 300); // 200 + (20 * 5)
  });

  it('should respect snap-to-grid settings', () => {
    const mockGetNodes = vi.fn(() => [mockNode1]);
    const mockSnap = vi.fn((x, y) => ({ x: Math.round(x / 20) * 20, y: Math.round(y / 20) * 20 }));
    const mockOnToolMove = vi.fn();

    const { result } = renderHook(() => useArrowKeyMovement({
      getNodes: mockGetNodes,
      snap: mockSnap,
      onToolMove: mockOnToolMove,
      gridSize: [20, 20]
    }));

    const moveHandler = result.current;
    const event = createMockEvent('ArrowLeft');
    moveHandler(event);

    expect(mockSnap).toHaveBeenCalledWith(80, 200); // 100 - 20
    expect(mockOnToolMove).toHaveBeenCalledWith('node1', 80, 200);
  });

  it('should return false for non-arrow keys', () => {
    const mockGetNodes = vi.fn(() => [mockNode1]);
    const mockSnap = vi.fn((x, y) => ({ x, y }));
    const mockOnToolMove = vi.fn();

    const { result } = renderHook(() => useArrowKeyMovement({
      getNodes: mockGetNodes,
      snap: mockSnap,
      onToolMove: mockOnToolMove,
    }));

    const moveHandler = result.current;
    const event = createMockEvent('Space');
    const handled = moveHandler(event);

    expect(handled).toBe(false);
    expect(mockOnToolMove).not.toHaveBeenCalled();
  });

  it('should return false when no nodes are selected', () => {
    const mockGetNodes = vi.fn(() => [mockNode3]); // mockNode3 is not selected
    const mockSnap = vi.fn((x, y) => ({ x, y }));
    const mockOnToolMove = vi.fn();

    const { result } = renderHook(() => useArrowKeyMovement({
      getNodes: mockGetNodes,
      snap: mockSnap,
      onToolMove: mockOnToolMove,
    }));

    const moveHandler = result.current;
    const event = createMockEvent('ArrowRight');
    const handled = moveHandler(event);

    expect(handled).toBe(false);
    expect(mockOnToolMove).not.toHaveBeenCalled();
  });

  it('should work without transaction handlers', () => {
    const mockGetNodes = vi.fn(() => [mockNode1]);
    const mockSnap = vi.fn((x, y) => ({ x, y }));
    const mockOnToolMove = vi.fn();

    const { result } = renderHook(() => useArrowKeyMovement({
      getNodes: mockGetNodes,
      snap: mockSnap,
      onToolMove: mockOnToolMove,
      // No transaction handlers provided
    }));

    const moveHandler = result.current;
    const event = createMockEvent('ArrowRight');
    const handled = moveHandler(event);

    expect(handled).toBe(true);
    expect(mockOnToolMove).toHaveBeenCalledWith('node1', 120, 200);
  });
});
