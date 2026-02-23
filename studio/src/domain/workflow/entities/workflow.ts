import { LucideIcon } from 'lucide-react';

// Domain entities and type contracts for workflow graph (moved from src/types/workflow.ts)

// Tool configuration value type for serialization
export type FieldValue =
  | string
  | number
  | boolean
  | string[]
  | null
  | Record<string, unknown>[]
  | Record<string, unknown>;

/** Default engine identifier for tools that don't specify one */
export const DEFAULT_ENGINE = "sigilweaver/polars";

export interface WorkflowMeta {
  name: string;
  description: string;
  author: string;
  workflowId: string;
  created: string;
  /** Default engine for all tools in this workflow. Omit to use DEFAULT_ENGINE. */
  defaultEngine?: string;
}

/**
 * Tracks which configuration fields differ from defaults and should be serialized.
 */
export interface EmissionMap {
  [key: string]: boolean | EmissionMap | undefined;
}

export type ToolConfig = {
  [key: string]: FieldValue | EmissionMap | undefined;
  _emit?: EmissionMap;
};

export interface Socket {
  id: string;
  direction: "input" | "output";
  type?: string;
  multiple?: boolean;
}

export interface Tool {
  id: string;
  type: string;
  /** Execution engine for this tool. Omit to inherit from WorkflowMeta.defaultEngine. */
  engine?: string;
  /**
   * Tool comment displayed on canvas and in generated code.
   * - undefined: auto-generate from config
   * - "": user explicitly cleared (no comment shown)
   * - "text": user-provided custom comment
   */
  comment?: string;
  x: number;
  y: number;
  config: ToolConfig;
  sockets: Socket[];
}

export interface Wire {
  from: { tool: string; socket: string };
  to: { tool: string; socket: string };
}

export interface ToolDefinition {
  type: string;
  name: string;
  icon: LucideIcon;
  category: "connect" | "compute" | "reshape" | "combine";
  defaultConfig: ToolConfig;
  sockets: Socket[];
  docsUrl?: string;
  blocking?: boolean;
}

export type ToolCategory =
  | "favorites"
  | "connect"
  | "compute"
  | "reshape"
  | "combine";

export interface ConnectionState {
  isConnecting: boolean;
  startTool?: string;
  startSocket?: string;
  startSocketType?: "input" | "output";
  currentX?: number;
  currentY?: number;
}
