/**
 * WorkflowSerializer - JSON-based workflow serialization service
 *
 * Provides stateless methods for serializing/deserializing workflow state
 * to/from JSON format.
 *
 * File Format: .swwf v2.0 (JSON)
 */

import { Tool, ToolConfig, Wire, WorkflowMeta } from "@domain/workflow/entities/workflow";

/**
 * JSON workflow file format (v2.0)
 */
export interface WorkflowJSON {
  version: string;
  meta: WorkflowMeta;
  tools: Tool[];
  wires: Wire[];
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[] | undefined;
}

/**
 * WorkflowSerializer - Pure service for JSON serialization
 */
export class WorkflowSerializer {
  private static readonly VERSION = "2.0";

  /**
   * Filter config fields based on emission map
   * Only includes fields marked for emission (where _emit[field] === true)
   * 
   * Always includes structural fields regardless of emission:
   * - category: Data source category (file, database, etc.)
   * - type: Data source type (csv, parquet, etc.)
   * - csvMode: CSV reading mode (scan, read, batched)
   *
   * @param config - Tool configuration
   * @param emit - Emission map indicating which fields to serialize
   * @returns Filtered configuration with only emitted fields
   */
  private static filterEmittedFields(
    config: Record<string, unknown>,
    emit: Record<string, unknown> | undefined
  ): ToolConfig {
    // Fields that must always be included (structural/discriminator fields)
    const alwaysInclude = new Set(['category', 'type', 'csvMode']);

    if (!emit) {
      // No emission map means include all fields (except _emit)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _emit, ...rest } = config;
      return rest as ToolConfig;
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(config)) {
      if (key === "_emit") {
        // Never include _emit in serialized output
        continue;
      }

      // Always include structural fields
      if (alwaysInclude.has(key)) {
        result[key] = value;
        continue;
      }

      const emitValue = emit[key];

      if (emitValue === true) {
        // Field is marked for emission
        result[key] = value;
      } else if (
        typeof emitValue === "object" &&
        emitValue !== null &&
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Recursively filter nested objects
        const nested = this.filterEmittedFields(
          value as Record<string, unknown>,
          emitValue as Record<string, unknown>
        );
        // Only include parent key if nested object has content
        if (Object.keys(nested).length > 0) {
          result[key] = nested;
        }
      }
      // If emitValue is false/undefined, don't include the field
    }

    return result as ToolConfig;
  }

  /**
   * Serialize workflow state to JSON string
   *
   * @param tools - Array of tools in the workflow
   * @param wires - Array of wires connecting tools
   * @param meta - Workflow metadata
   * @returns JSON string representation of the workflow
   *
   * @example
   * const json = WorkflowSerializer.toJSON(tools, wires, meta);
   * fs.writeFile('workflow.swwf', json);
   */
  static toJSON(tools: Tool[], wires: Wire[], meta: WorkflowMeta): string {
    // Filter configs based on _emit map (only include fields marked for emission)
    const cleanTools = tools.map((tool) => {
      const emit = tool.config._emit as Record<string, unknown> | undefined;
      const filteredConfig = this.filterEmittedFields(
        tool.config as Record<string, unknown>,
        emit
      );

      return {
        ...tool,
        config: filteredConfig,
      };
    });

    const workflow: WorkflowJSON = {
      version: this.VERSION,
      meta,
      tools: cleanTools,
      wires,
    };

    // Pretty print with 2-space indentation for readability
    return JSON.stringify(workflow, null, 2);
  }

  /**
   * Deserialize workflow from JSON string
   *
   * @param json - JSON string to parse
   * @returns Parsed workflow components
   * @throws Error if JSON is invalid or validation fails
   *
   * @example
   * const { tools, wires, meta } = WorkflowSerializer.fromJSON(jsonString);
   * workflowStore.loadWorkflow(tools, wires, meta);
   */
  static fromJSON(json: string): {
    tools: Tool[];
    wires: Wire[];
    meta: WorkflowMeta;
  } {
    try {
      const data = JSON.parse(json) as WorkflowJSON;

      // Validate structure
      const validation = this.validate(data);
      if (!validation.valid) {
        throw new Error(
          `Workflow validation failed: ${validation.errors?.join(", ")}`
        );
      }

      return {
        tools: data.tools,
        wires: data.wires,
        meta: data.meta,
      };
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Validate workflow JSON structure
   *
   * @param data - Parsed JSON data to validate
   * @returns Validation result with any errors
   *
   * @example
   * const result = WorkflowSerializer.validate(data);
   * if (!result.valid) {
   *   console.error('Validation errors:', result.errors);
   * }
   */
  static validate(data: unknown): ValidationResult {
    const errors: string[] = [];

    // Type guard
    if (typeof data !== "object" || data === null) {
      return { valid: false, errors: ["Data must be an object"] };
    }

    const workflow = data as Partial<WorkflowJSON>;

    // Check required top-level fields
    if (!workflow.version) {
      errors.push("Missing required field: version");
    } else if (typeof workflow.version !== "string") {
      errors.push('Field "version" must be a string');
    }

    if (!workflow.meta) {
      errors.push("Missing required field: meta");
    } else if (typeof workflow.meta !== "object") {
      errors.push('Field "meta" must be an object');
    } else {
      // Validate meta fields
      const meta = workflow.meta as Partial<WorkflowMeta>;
      if (!meta.name) {
        errors.push("Missing required field: meta.name");
      }
      if (!meta.workflowId) {
        errors.push("Missing required field: meta.workflowId");
      }
    }

    if (!workflow.tools) {
      errors.push("Missing required field: tools");
    } else if (!Array.isArray(workflow.tools)) {
      errors.push('Field "tools" must be an array');
    } else {
      // Validate each tool
      workflow.tools.forEach((tool, index) => {
        if (typeof tool !== "object" || tool === null) {
          errors.push(`Tool at index ${index} must be an object`);
          return;
        }

        const t = tool as Partial<Tool>;
        if (!t.id)
          errors.push(`Tool at index ${index} missing required field: id`);
        if (!t.type)
          errors.push(`Tool at index ${index} missing required field: type`);
        if (typeof t.x !== "number")
          errors.push(`Tool at index ${index} field "x" must be a number`);
        if (typeof t.y !== "number")
          errors.push(`Tool at index ${index} field "y" must be a number`);
        if (!t.config)
          errors.push(`Tool at index ${index} missing required field: config`);
        if (!t.sockets || !Array.isArray(t.sockets)) {
          errors.push(
            `Tool at index ${index} field "sockets" must be an array`
          );
        } else {
          // Validate sockets
          t.sockets.forEach((socket, socketIndex) => {
            if (typeof socket !== "object" || socket === null) {
              errors.push(
                `Tool ${index} socket ${socketIndex} must be an object`
              );
              return;
            }
            const s = socket as unknown as Record<string, unknown>;
            if (typeof s.id !== "string") {
              errors.push(
                `Tool ${index} socket ${socketIndex} field "id" must be a string`
              );
            }
            if (s.direction !== "input" && s.direction !== "output") {
              errors.push(
                `Tool ${index} socket ${socketIndex} field "direction" must be "input" or "output"`
              );
            }
            // 'multiple' is optional, only validate if present
            if (s.multiple !== undefined && typeof s.multiple !== "boolean") {
              errors.push(
                `Tool ${index} socket ${socketIndex} field "multiple" must be a boolean if present`
              );
            }
            // 'type' is optional, only validate if present
            if (s.type !== undefined && typeof s.type !== "string") {
              errors.push(
                `Tool ${index} socket ${socketIndex} field "type" must be a string if present`
              );
            }
          });
        }
      });
    }

    if (!workflow.wires) {
      errors.push("Missing required field: wires");
    } else if (!Array.isArray(workflow.wires)) {
      errors.push('Field "wires" must be an array');
    } else {
      // Validate each wire
      workflow.wires.forEach((wire, index) => {
        if (typeof wire !== "object" || wire === null) {
          errors.push(`Wire at index ${index} must be an object`);
          return;
        }

        const w = wire as Partial<Wire>;
        if (!w.from) {
          errors.push(`Wire at index ${index} missing required field: from`);
        } else {
          if (typeof w.from.tool !== "string") {
            errors.push(`Wire ${index} field "from.tool" must be a string`);
          }
          if (typeof w.from.socket !== "string") {
            errors.push(`Wire ${index} field "from.socket" must be a string`);
          }
        }

        if (!w.to) {
          errors.push(`Wire at index ${index} missing required field: to`);
        } else {
          if (typeof w.to.tool !== "string") {
            errors.push(`Wire ${index} field "to.tool" must be a string`);
          }
          if (typeof w.to.socket !== "string") {
            errors.push(`Wire ${index} field "to.socket" must be a string`);
          }
        }
      });
    }

    if (errors.length === 0) {
      return { valid: true, errors: undefined };
    }
    return { valid: false, errors };
  }

  /**
   * Create an empty workflow with default metadata
   *
   * @param name - Optional workflow name
   * @returns JSON string for a new empty workflow
   *
   * @example
   * const json = WorkflowSerializer.createEmpty('My New Workflow');
   * fs.writeFile('workflow.swwf', json);
   */
  static createEmpty(name: string = "New Workflow"): string {
    const meta: WorkflowMeta = {
      name,
      description: "",
      author: "",
      workflowId: `wf_${Date.now()}`,
      created: new Date().toISOString(),
    };

    return this.toJSON([], [], meta);
  }

  /**
   * Check if a string appears to be JSON
   *
   * @param content - File content to check
   * @returns true if content appears to be JSON
   *
   * @example
   * const content = fs.readFile('workflow.swwf');
   * if (WorkflowSerializer.isJSON(content)) {
   *   // Parse as JSON
   * } else {
   *   // Handle invalid format
   * }
   */
  static isJSON(content: string): boolean {
    const trimmed = content.trim();
    return trimmed.startsWith("{") || trimmed.startsWith("[");
  }

  /**
   * Get the version of a workflow JSON
   *
   * @param json - JSON string to parse
   * @returns Version string or null if invalid
   */
  static getVersion(json: string): string | null {
    try {
      const data = JSON.parse(json) as Partial<WorkflowJSON>;
      return data.version || null;
    } catch {
      return null;
    }
  }
}
