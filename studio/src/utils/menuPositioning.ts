/**
 * Utility functions for smart menu positioning that avoids screen edges
 * 
 * Perfect for:
 * - Context menus
 * - Dropdown menus  
 * - Tooltips
 * - Popover components
 * - Any floating UI element that needs smart positioning
 * 
 * @example
 * ```tsx
 * // Basic usage
 * const position = calculateMenuPosition(
 *   buttonRef.current.getBoundingClientRect(),
 *   { width: 120, height: 160 }
 * );
 * 
 * // With custom placement preference
 * const position = calculateMenuPosition(
 *   triggerRect,
 *   { width: 200, height: 300 },
 *   8, // offset
 *   'top' // preferred placement
 * );
 * 
 * // Using the hook
 * const getMenuPosition = useMenuPositioning({ width: 120, height: 160 });
 * const position = getMenuPosition(triggerElement);
 * 
 * // Tooltip example
 * const tooltipPosition = calculateMenuPosition(
 *   hoverTargetRect,
 *   { width: 200, height: 50 },
 *   8,
 *   'top'
 * );
 * ```
 */

export interface MenuDimensions {
  width: number;
  height: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface PositionResult {
  x: number;
  y: number;
  placement: 'bottom' | 'top' | 'right' | 'left';
}

/**
 * Calculate optimal menu position relative to a trigger element, avoiding screen edges
 * @param triggerRect - DOMRect of the trigger element
 * @param menuDimensions - Width and height of the menu
 * @param offset - Offset from the trigger element (default: 4px)
 * @param preferredPlacement - Preferred placement direction (default: 'bottom')
 * @returns Optimal position and actual placement used
 */
export function calculateMenuPosition(
  triggerRect: DOMRect,
  menuDimensions: MenuDimensions,
  offset: number = 4,
  preferredPlacement: 'bottom' | 'top' | 'right' | 'left' = 'bottom'
): PositionResult {
  const { width: menuWidth, height: menuHeight } = menuDimensions;
  const padding = 8; // Minimum padding from screen edges
  
  // Screen dimensions
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  
  // Calculate positions for each placement option
  const placements = {
    bottom: {
      x: triggerRect.left,
      y: triggerRect.bottom + offset,
      fitsX: triggerRect.left + menuWidth <= screenWidth - padding,
      fitsY: triggerRect.bottom + offset + menuHeight <= screenHeight - padding,
    },
    top: {
      x: triggerRect.left,
      y: triggerRect.top - menuHeight - offset,
      fitsX: triggerRect.left + menuWidth <= screenWidth - padding,
      fitsY: triggerRect.top - menuHeight - offset >= padding,
    },
    right: {
      x: triggerRect.right + offset,
      y: triggerRect.top,
      fitsX: triggerRect.right + offset + menuWidth <= screenWidth - padding,
      fitsY: triggerRect.top + menuHeight <= screenHeight - padding,
    },
    left: {
      x: triggerRect.left - menuWidth - offset,
      y: triggerRect.top,
      fitsX: triggerRect.left - menuWidth - offset >= padding,
      fitsY: triggerRect.top + menuHeight <= screenHeight - padding,
    },
  };
  
  // Try preferred placement first
  const preferred = placements[preferredPlacement];
  if (preferred.fitsX && preferred.fitsY) {
    return {
      x: preferred.x,
      y: preferred.y,
      placement: preferredPlacement,
    };
  }
  
  // Try other placements in order of preference
  const fallbackOrder: Array<keyof typeof placements> = 
    preferredPlacement === 'bottom' ? ['top', 'right', 'left'] :
    preferredPlacement === 'top' ? ['bottom', 'right', 'left'] :
    preferredPlacement === 'right' ? ['left', 'bottom', 'top'] :
    ['right', 'bottom', 'top'];
  
  for (const placement of fallbackOrder) {
    const option = placements[placement];
    if (option.fitsX && option.fitsY) {
      return {
        x: option.x,
        y: option.y,
        placement,
      };
    }
  }
  
  // If no placement fits perfectly, use the preferred one but adjust position
  let { x, y } = preferred;
  
  // Adjust horizontal position
  if (x + menuWidth > screenWidth - padding) {
    x = screenWidth - menuWidth - padding;
  }
  if (x < padding) {
    x = padding;
  }
  
  // Adjust vertical position
  if (y + menuHeight > screenHeight - padding) {
    y = screenHeight - menuHeight - padding;
  }
  if (y < padding) {
    y = padding;
  }
  
  return {
    x,
    y,
    placement: preferredPlacement,
  };
}

/**
 * React hook for managing menu positioning
 * @param menuDimensions - Width and height of the menu
 * @param offset - Offset from trigger element
 * @param preferredPlacement - Preferred placement direction
 * @returns Function to calculate position from trigger element
 */
export function useMenuPositioning(
  menuDimensions: MenuDimensions,
  offset?: number,
  preferredPlacement?: 'bottom' | 'top' | 'right' | 'left'
) {
  return (triggerElement: HTMLElement) => {
    const rect = triggerElement.getBoundingClientRect();
    return calculateMenuPosition(rect, menuDimensions, offset, preferredPlacement);
  };
}
