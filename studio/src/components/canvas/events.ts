/**
 * Document-level events the canvas listens for, so panels outside the React
 * Flow provider can act on the canvas without a shared ref.
 */

/** Deselect all tools and wires and close the tool configuration. */
export const CLEAR_CANVAS_SELECTION_EVENT = 'loom:clear-canvas-selection';

export function requestClearCanvasSelection(): void {
  document.dispatchEvent(new CustomEvent(CLEAR_CANVAS_SELECTION_EVENT));
}
