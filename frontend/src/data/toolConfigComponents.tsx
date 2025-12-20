/**
 * Tool Configuration Component Registry
 *
 * Maps tool types to their configuration panel components.
 * Mirrors the TOOL_DEFINITIONS pattern in tools.ts.
 *
 * This eliminates the large switch statement in ConfigurationPanel.tsx
 * and makes adding new tools more modular - you just add an entry here.
 */

import { ComponentType } from "react";
import {
  Tool,
  ToolConfig,
  Wire,
  WorkflowMeta,
} from "@domain/workflow/entities/workflow";

// Tool configuration components
import { FilterConfiguration } from "@components/FilterConfiguration";
import { FormulaConfiguration } from "@components/FormulaConfiguration";
import { SelectConfiguration } from "@components/SelectConfiguration";
import { SortConfiguration } from "@components/SortConfiguration";
import { SummarizeConfiguration } from "@components/SummarizeConfiguration";
import { UnionConfiguration } from "@components/UnionConfiguration";
import { JoinConfiguration } from "@components/JoinConfiguration";
import { SampleConfiguration } from "@components/SampleConfiguration";

/**
 * Base props that all configuration components receive
 */
export interface BaseConfigProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
}

/**
 * Extended props for tools that need workflow context
 * (for metadata fetching, column autocomplete, etc.)
 */
export interface WorkflowContextConfigProps extends BaseConfigProps {
  toolId: string;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: WorkflowMeta;
}

/**
 * Configuration entry for tools that only need base props
 */
interface BaseToolConfigEntry {
  component: ComponentType<BaseConfigProps>;
  needsWorkflowContext: false;
}

/**
 * Configuration entry for tools that need workflow context
 */
interface ContextToolConfigEntry {
  component: ComponentType<WorkflowContextConfigProps>;
  needsWorkflowContext: true;
}

/**
 * Discriminated union of configuration entries
 */
export type ToolConfigEntry = BaseToolConfigEntry | ContextToolConfigEntry;

/**
 * Registry mapping tool types to their configuration components
 *
 * Note: Input and Output tools are handled specially in ConfigurationPanel
 * because they have dynamic sub-types (csv, parquet, excel, etc.)
 * that each have their own configuration components.
 */
export const TOOL_CONFIG_REGISTRY: Record<string, ToolConfigEntry> = {
  // Preparation Tools
  Filter: {
    component: FilterConfiguration,
    needsWorkflowContext: true,
  },
  Formula: {
    component: FormulaConfiguration,
    needsWorkflowContext: true,
  },
  Select: {
    component: SelectConfiguration,
    needsWorkflowContext: true,
  },
  Sort: {
    component: SortConfiguration,
    needsWorkflowContext: true,
  },
  Sample: {
    component: SampleConfiguration,
    needsWorkflowContext: false,
  },

  // Join Tools
  Union: {
    component: UnionConfiguration,
    needsWorkflowContext: false,
  },
  Join: {
    component: JoinConfiguration,
    needsWorkflowContext: true,
  },

  // Aggregate Tools
  Summarize: {
    component: SummarizeConfiguration,
    needsWorkflowContext: true,
  },
};

/**
 * Get configuration component for a tool type
 *
 * @param toolType - The tool type (e.g., "Filter", "Select")
 * @returns The configuration entry or undefined if not found
 */
export function getToolConfigEntry(toolType: string): ToolConfigEntry | undefined {
  return TOOL_CONFIG_REGISTRY[toolType];
}

/**
 * Check if a tool type has a registered configuration component
 *
 * Note: Returns false for Input/Output which have special handling
 */
export function hasConfigComponent(toolType: string): boolean {
  return toolType in TOOL_CONFIG_REGISTRY;
}
