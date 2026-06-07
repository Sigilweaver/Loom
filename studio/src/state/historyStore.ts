/**
 * historyStore - Clean undo/redo system with predictable behavior
 *
 * Design Philosophy:
 * - Past stack: States you can undo TO (previous states)
 * - Future stack: States you can redo TO (forward states after undo)
 * - Simple API: Just call pushState() after each action
 * - Automatic: undo/redo manage state movement internally
 *
 * Example Flow:
 *   Start: []
 *   Add tool A: past=[empty]
 *   Add tool B: past=[empty, A]
 *   Undo: past=[empty], future=[A, B], returns A
 *   Undo: past=[], future=[empty, A, B], returns empty
 *   Redo: past=[empty], future=[A, B], returns A
 *   Add tool C: past=[empty, A], future=[] (future cleared on new action)
 */

import { Tool, Wire, WorkflowMeta } from "@domain/workflow/entities/workflow";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useWorkflowStore } from "./workflowStore";

/**
 * Workflow snapshot - complete state at a point in time
 */
export interface WorkflowSnapshot {
  tools: Tool[];
  wires: Wire[];
  meta: WorkflowMeta;
  timestamp: number;
}

/**
 * History store state
 */
interface HistoryState {
  // History stacks - past contains states to undo TO, future contains states to redo TO
  past: WorkflowSnapshot[];
  future: WorkflowSnapshot[];

  // Configuration
  maxHistoryDepth: number;

  // Actions
  pushState: (tools: Tool[], wires: Wire[], meta: WorkflowMeta) => void;
  /**
   * Variant of pushState that coalesces consecutive drag operations within
   * a 250ms window. If the top-of-stack snapshot was pushed via
   * pushDragState within DRAG_COALESCE_MS, it is *replaced* in place
   * rather than appended. This keeps undo granularity meaningful while
   * preventing drag-heavy workflows from blowing through maxHistoryDepth.
   */
  pushDragState: (tools: Tool[], wires: Wire[], meta: WorkflowMeta) => void;
  undo: () => WorkflowSnapshot | null;
  redo: () => WorkflowSnapshot | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
  setMaxDepth: (depth: number) => void;
}

// Drag coalescing window. Consecutive pushDragState calls inside
// this window replace the latest history entry instead of appending.
const DRAG_COALESCE_MS = 250;

/**
 * Deep clone using JSON serialization
 * Fast, reliable, and guaranteed to work with our data structures
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * History store for undo/redo functionality
 *
 * @example
 * // After user adds a tool - push the state BEFORE the addition
 * historyStore.getState().pushState(tools, wires, workflowMeta);
 * // Then make the change
 * workflowStore.getState().addTool(newTool);
 *
 * // Undo - pass current state, get previous state back
 * const { tools, wires, workflowMeta } = workflowStore.getState();
 * const prevState = historyStore.getState().undo(tools, wires, workflowMeta);
 * if (prevState) {
 *   workflowStore.getState().loadWorkflow(prevState.tools, prevState.wires, prevState.meta);
 * }
 *
 * // Redo - pass current state, get next state back
 * const nextState = historyStore.getState().redo(tools, wires, workflowMeta);
 * if (nextState) {
 *   workflowStore.getState().loadWorkflow(nextState.tools, nextState.wires, nextState.meta);
 * }
 */
export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      past: [],
      future: [],
      maxHistoryDepth: 50,

      /**
       * Push current state to history
       *
       * Call this BEFORE making a change that should be undoable.
       * This saves the current state so you can undo back to it.
       * Clears the future stack (can't redo after new actions).
       *
       * @param tools - Current tools array (before change)
       * @param wires - Current wires array (before change)
       * @param meta - Current workflow metadata (before change)
       */
      pushState: (tools: Tool[], wires: Wire[], meta: WorkflowMeta) =>
        set((state) => {
          const snapshot: WorkflowSnapshot = {
            tools: deepClone(tools),
            wires: deepClone(wires),
            meta: deepClone(meta),
            timestamp: Date.now(),
          };

          let newPast = [...state.past, snapshot];
          if (newPast.length > state.maxHistoryDepth) {
            newPast = newPast.slice(newPast.length - state.maxHistoryDepth);
          }

          return {
            past: newPast,
            future: [], // Clear future on new action
          };
        }),

      /**
       * Push a drag-source snapshot. Coalesces with the immediately
       * preceding pushDragState entry when within DRAG_COALESCE_MS so a
       * drag gesture produces a single undo step. Falls through to a
       * normal pushState semantics on the first call of a gesture.
       */
      pushDragState: (tools: Tool[], wires: Wire[], meta: WorkflowMeta) =>
        set((state) => {
          const now = Date.now();
          const snapshot: WorkflowSnapshot = {
            tools: deepClone(tools),
            wires: deepClone(wires),
            meta: deepClone(meta),
            timestamp: now,
          };

          const last = state.past[state.past.length - 1];
          if (
            last &&
            (last as WorkflowSnapshot & { __drag?: boolean }).__drag === true &&
            now - last.timestamp <= DRAG_COALESCE_MS
          ) {
            // Coalesce: keep the original snapshot (oldest pre-gesture
            // state), just refresh the timestamp so further drags within
            // the window keep extending the coalesce window.
            const refreshed: WorkflowSnapshot = {
              ...last,
              timestamp: now,
            };
            (refreshed as WorkflowSnapshot & { __drag?: boolean }).__drag = true;
            const newPast = state.past.slice(0, -1);
            newPast.push(refreshed);
            return { past: newPast, future: [] };
          }

          (snapshot as WorkflowSnapshot & { __drag?: boolean }).__drag = true;
          let newPast = [...state.past, snapshot];
          if (newPast.length > state.maxHistoryDepth) {
            newPast = newPast.slice(newPast.length - state.maxHistoryDepth);
          }
          return { past: newPast, future: [] };
        }),

      /**
       * Undo to previous state
       *
       * Reads current state from workflowStore, saves it to future, pops from past.
       * Returns the previous state to restore, or null if nothing to undo.
       *
       * @returns The previous state to restore, or null
       */
      undo: () => {
        const state = get();
        if (state.past.length === 0) {
          return null;
        }

        // Get the state to restore (from end of past stack)
        const restoreState = state.past[state.past.length - 1];
        if (!restoreState) {
          return null;
        }

        // Read current state directly from workflowStore
        const currentWorkflow = useWorkflowStore.getState();
        const currentSnapshot: WorkflowSnapshot = {
          tools: deepClone(currentWorkflow.tools),
          wires: deepClone(currentWorkflow.wires),
          meta: deepClone(currentWorkflow.workflowMeta),
          timestamp: Date.now(),
        };

        set({
          past: state.past.slice(0, -1),
          future: [...state.future, currentSnapshot],
        });

        return restoreState;
      },

      /**
       * Redo to next state
       *
       * Reads current state from workflowStore, saves it to past, pops from future.
       * Returns the next state to restore, or null if nothing to redo.
       *
       * @returns The next state to restore, or null
       */
      redo: () => {
        const state = get();
        if (state.future.length === 0) {
          return null;
        }

        // Get the state to restore (from end of future stack)
        const restoreState = state.future[state.future.length - 1];
        if (!restoreState) {
          return null;
        }

        // Read current state directly from workflowStore
        const currentWorkflow = useWorkflowStore.getState();
        const currentSnapshot: WorkflowSnapshot = {
          tools: deepClone(currentWorkflow.tools),
          wires: deepClone(currentWorkflow.wires),
          meta: deepClone(currentWorkflow.workflowMeta),
          timestamp: Date.now(),
        };

        let newPast = [...state.past, currentSnapshot];
        if (newPast.length > state.maxHistoryDepth) {
          newPast = newPast.slice(newPast.length - state.maxHistoryDepth);
        }

        set({
          past: newPast,
          future: state.future.slice(0, -1),
        });

        return restoreState;
      },

      /**
       * Check if undo is available
       */
      canUndo: () => get().past.length > 0,

      /**
       * Check if redo is available
       */
      canRedo: () => get().future.length > 0,

      /**
       * Clear all history
       */
      clear: () =>
        set({
          past: [],
          future: [],
        }),

      /**
       * Set maximum history depth
       *
       * @param depth - Maximum number of snapshots to keep
       */
      setMaxDepth: (depth) =>
        set((state) => {
          let newPast = state.past;
          if (newPast.length > depth) {
            newPast = newPast.slice(newPast.length - depth);
          }

          return {
            maxHistoryDepth: depth,
            past: newPast,
          };
        }),
    }),
    { name: "HistoryStore" }
  )
);

// Selector hooks for optimized subscriptions
export const useCanUndo = () =>
  useHistoryStore((state) => state.past.length > 0);
export const useCanRedo = () =>
  useHistoryStore((state) => state.future.length > 0);
export const useHistoryDepth = () =>
  useHistoryStore((state) => ({
    past: state.past.length,
    future: state.future.length,
    max: state.maxHistoryDepth,
  }));
