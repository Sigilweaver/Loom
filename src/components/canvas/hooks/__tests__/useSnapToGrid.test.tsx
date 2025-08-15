import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSnapToGrid } from '../useSnapToGrid';
import { useUIStore } from '@state/uiStore';

// NOTE: When React Testing Library dependencies are added, this test will run under jsdom.

describe('useSnapToGrid', () => {
  it('snaps coordinates when snap is enabled by default', () => {
    const { result } = renderHook(() => useSnapToGrid([20, 20]));
    const { snap } = result.current;
    expect(snap(13, 27)).toEqual({ x: 20, y: 20 });
  });

  it('returns original coordinates after disabling snap', () => {
    const { result } = renderHook(() => useSnapToGrid([20, 20]));
    act(() => useUIStore.getState().toggleSnapToGrid()); // now disabled
    const { snap } = result.current;
    expect(snap(13, 27)).toEqual({ x: 13, y: 27 });
  });
});
