import { describe, it, expect } from 'vitest';
import { useUIStore } from '../uiStore';

describe('uiStore', () => {
  it('toggles snapToGrid', () => {
    const initial = useUIStore.getState().snapToGrid;
    useUIStore.getState().toggleSnapToGrid();
    expect(useUIStore.getState().snapToGrid).toBe(!initial);
  });

  it('shows and hides notification', () => {
    useUIStore.getState().showNotification('Hello', 'info', 50);
    expect(useUIStore.getState().notification.isVisible).toBe(true);
    useUIStore.getState().hideNotification();
    expect(useUIStore.getState().notification.isVisible).toBe(false);
  });
});
