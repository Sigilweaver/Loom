import { useCallback, useRef } from "react";

export interface UseLongPressOptions {
  /** Duration in ms before long press triggers (default: 500) */
  delay?: number;
  /** Called when long press is triggered */
  onLongPress: (event: React.TouchEvent) => void;
  /** Called on regular tap (touch shorter than delay) */
  onTap?: (event: React.TouchEvent) => void;
}

export interface UseLongPressResult {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
}

/**
 * Hook that detects long press gestures on touch devices.
 * Returns touch event handlers to attach to an element.
 * 
 * Long press triggers after `delay` ms of continuous touch without movement.
 * Movement beyond threshold cancels the long press.
 */
export function useLongPress({
  delay = 500,
  onLongPress,
  onTap,
}: UseLongPressOptions): UseLongPressResult {
  const timerRef = useRef<number | null>(null);
  const isLongPressRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const touchEventRef = useRef<React.TouchEvent | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      isLongPressRef.current = false;
      touchEventRef.current = event;

      const touch = event.touches[0];
      if (touch) {
        startPosRef.current = { x: touch.clientX, y: touch.clientY };
      }

      clearTimer();
      timerRef.current = window.setTimeout(() => {
        isLongPressRef.current = true;
        if (touchEventRef.current) {
          onLongPress(touchEventRef.current);
        }
      }, delay);
    },
    [delay, onLongPress, clearTimer]
  );

  const onTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      clearTimer();

      // If it wasn't a long press and we have an onTap handler, call it
      if (!isLongPressRef.current && onTap) {
        onTap(event);
      }

      isLongPressRef.current = false;
      startPosRef.current = null;
      touchEventRef.current = null;
    },
    [clearTimer, onTap]
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      // Cancel long press if finger moves too far (threshold: 10px)
      const touch = event.touches[0];
      const start = startPosRef.current;
      if (touch && start) {
        const dx = touch.clientX - start.x;
        const dy = touch.clientY - start.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 10) {
          clearTimer();
        }
      }
    },
    [clearTimer]
  );

  return {
    onTouchStart,
    onTouchEnd,
    onTouchMove,
  };
}
