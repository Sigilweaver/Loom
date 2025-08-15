import { create } from 'zustand';

type NotificationType = 'error' | 'warning' | 'success' | 'info';

interface NotificationState {
  message: string;
  type: NotificationType;
  isVisible: boolean;
  duration: number; // ms
  expiresAt?: number; // timestamp when it should auto-hide
}

interface UIState {
  snapToGrid: boolean;
  minimapVisible: boolean;
  minimapPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  positionMenuOpen: boolean;
  positionMenuCoords: { x: number; y: number } | null;
  notification: NotificationState;
  toggleSnapToGrid: () => void;
  toggleMinimap: () => void;
  setMinimapPosition: (pos: UIState['minimapPosition']) => void;
  openPositionMenu: (coords: { x: number; y: number }) => void;
  closePositionMenu: () => void;
  showNotification: (message: string, type?: NotificationType, duration?: number) => void;
  hideNotification: () => void;
  maybeAutoHide: () => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  snapToGrid: true,
  minimapVisible: false,
  minimapPosition: 'bottom-right',
  positionMenuOpen: false,
  positionMenuCoords: null,
  notification: { message: '', type: 'info', isVisible: false, duration: 6000 },
  toggleSnapToGrid: () => set(s => ({ snapToGrid: !s.snapToGrid })),
  toggleMinimap: () => set(s => ({ minimapVisible: !s.minimapVisible })),
  setMinimapPosition: (pos) => set({ minimapPosition: pos, positionMenuOpen: false }),
  openPositionMenu: (coords) => set({ positionMenuOpen: true, positionMenuCoords: coords }),
  closePositionMenu: () => set({ positionMenuOpen: false }),
  showNotification: (message, type = 'info', duration = 6000) => set({ notification: { message, type, isVisible: true, duration, expiresAt: Date.now() + duration } }),
  hideNotification: () => set(s => ({ notification: { ...s.notification, isVisible: false } })),
  maybeAutoHide: () => {
    const { notification } = get();
    if (notification.isVisible && notification.expiresAt && Date.now() >= notification.expiresAt) {
      set({ notification: { ...notification, isVisible: false } });
    }
  }
}));

let autoHideStarted = false;
export function startNotificationAutoHide(intervalMs = 1000) {
  if (autoHideStarted) return;
  autoHideStarted = true;
  setInterval(() => {
    useUIStore.getState().maybeAutoHide();
  }, intervalMs);
}
