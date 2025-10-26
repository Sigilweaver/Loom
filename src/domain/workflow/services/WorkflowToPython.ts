import type { Tool, Wire } from "../entities/workflow";

/**
 * WorkflowToPython - Generate executable Python code from workflow
 * 
 * Converts a visual workflow into a standalone Python script that uses Polars
 * to perform the same transformations. The generated code can be run independently.
 */
export class WorkflowToPython {
  /**
   * Get semantic name for a socket based on tool type and socket ID
   */
  private static getSocketName(toolType: string, socketId: number, direction: "input" | "output"): string {
    // For single input/output tools, use simple names
    if (direction === "input") {
      switch (toolType) {
        case "Join":
          return socketId === 0 ? "left" : "right";
        case "Union":
          // Union has multiple inputs, but we'll handle that specially
          return "input";
        default:
          return "input";
      }
    }
    
    // Output socket names
    switch (toolType) {
      case "Input":
        return "output";
      case "Filter":
        return socketId === 1 ? "true" : "false";
      case "Join":
        if (socketId === 2) return "left_only";
        if (socketId === 3) return "joined";
        if (socketId === 4) return "right_only";
        return "output";
      case "Select":
      case "Sort":
      case "Formula":
      case "Union":
      case "Summarize":
      default:
        return "output";
    }
  }

  /**
   * Build a dataframe variable name with semantic socket suffix
   */
  private static buildVarName(toolId: string, socketName: string): string {
    const baseName = `df_${this.sanitizeVarName(toolId)}`;
    return socketName === "output" ? baseName : `${baseName}_${socketName}`;
  }
  
  /**
   * Generate a descriptive comment for a tool
   */
  private static generateToolComment(tool: Tool): string {
    // Just show tool type and ID - the code itself is self-documenting
    return `# ${tool.type}: ${tool.id}`;
  }

  /**
   * Convert workflow to executable Python code
   */
  static toPython(tools: Tool[], wires: Wire[]): string {
    const lines: string[] = [];
    
    // Header
    lines.push("#!/usr/bin/env python3");
    lines.push('"""');
    lines.push("Auto-generated Sigilweaver workflow");
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('"""');
    lines.push("");
    lines.push("import polars as pl");
    lines.push("");
    
    // Build dependency graph
    const toolMap = new Map(tools.map(t => [t.id, t]));
    const inputsByTool = this.buildInputMap(wires);
    
    // Topological sort to get execution order
    const executionOrder = this.topologicalSort(tools, wires);
    
    if (executionOrder.length === 0 && tools.length > 0) {
      lines.push("# ERROR: Workflow contains cycles or invalid connections");
      return lines.join("\n");
    }
    
    // Generate code for each tool in order
    const dataframeNames = new Map<string, string>(); // toolId_socketId -> variable name
    
    for (const toolId of executionOrder) {
      const tool = toolMap.get(toolId);
      if (!tool) continue;
      
      lines.push(this.generateToolComment(tool));
      const code = this.generateToolCode(tool, inputsByTool, dataframeNames);
      lines.push(...code);
      lines.push("");
    }
    
    // Add example output collection
    lines.push("# Collect and display results");
    lines.push("# (uncomment to execute)");
    for (const [varName] of dataframeNames) {
      if (varName.startsWith("df_")) {
        lines.push(`# print(${varName}.collect())`);
      }
    }
    
    return lines.join("\n");
  }
  
  /**
   * Generate Python code for a specific tool
   */
  private static generateToolCode(
    tool: Tool,
    inputsByTool: Map<string, Array<{fromTool: string; fromSocket: number; toSocket: number}>>,
    dataframeNames: Map<string, string>
  ): string[] {
    const lines: string[] = [];
    const inputs = inputsByTool.get(tool.id) || [];
    
    switch (tool.type) {
      case "Input":
        return this.generateInputCode(tool, dataframeNames);
      case "Filter":
        return this.generateFilterCode(tool, inputs, dataframeNames);
      case "Formula":
        return this.generateFormulaCode(tool, inputs, dataframeNames);
      case "Multiplier":
        return this.generateMultiplierCode(tool, inputs, dataframeNames);
      default:
        lines.push(`# TODO: ${tool.type} not yet supported in code generation`);
        return lines;
    }
  }
  
  /**
   * Generate code for Input (CSV) tool
   */
  private static generateInputCode(
    tool: Tool,
    dataframeNames: Map<string, string>
  ): string[] {
    const lines: string[] = [];
    const config = tool.config;
    const source = String(config.source || "");
    const mode = config.csvMode || "scan";
    
    const socketName = this.getSocketName(tool.type, 0, "output");
    const varName = this.buildVarName(tool.id, socketName);
    dataframeNames.set(`${tool.id}_0`, varName);
    
    if (!source) {
      lines.push(`${varName} = None  # ERROR: No source file specified`);
      return lines;
    }
    
    const funcName = mode === "read" ? "read_csv" : "scan_csv";
    lines.push(`${varName} = pl.${funcName}("${this.escapePath(source)}")`);
    
    return lines;
  }
  
  /**
   * Generate code for Filter tool
   */
  private static generateFilterCode(
    tool: Tool,
    inputs: Array<{fromTool: string; fromSocket: number; toSocket: number}>,
    dataframeNames: Map<string, string>
  ): string[] {
    const lines: string[] = [];
    const config = tool.config;
    const expression = config.expression || "";
    
    if (inputs.length === 0) {
      lines.push(`# ERROR: Filter ${tool.id} has no input`);
      return lines;
    }
    
    const input = inputs[0]!; // Safe: length check above guarantees this exists
    const inputVar = dataframeNames.get(`${input.fromTool}_${input.fromSocket}`);
    if (!inputVar) {
      lines.push(`# ERROR: Filter ${tool.id} input not found`);
      return lines;
    }
    
    if (!expression) {
      lines.push(`# ERROR: Filter ${tool.id} has no expression`);
      return lines;
    }
    
    // Generate variable names for true/false outputs
    const trueSocketName = this.getSocketName(tool.type, 1, "output");
    const falseSocketName = this.getSocketName(tool.type, 2, "output");
    const trueVar = this.buildVarName(tool.id, trueSocketName);
    const falseVar = this.buildVarName(tool.id, falseSocketName);
    
    dataframeNames.set(`${tool.id}_1`, trueVar);
    dataframeNames.set(`${tool.id}_2`, falseVar);
    
    lines.push(`${trueVar} = ${inputVar}.filter(${expression})`);
    lines.push(`${falseVar} = ${inputVar}.filter(~(${expression}))`);
    
    return lines;
  }
  
  /**
   * Generate code for Formula tool
   */
  private static generateFormulaCode(
    tool: Tool,
    inputs: Array<{fromTool: string; fromSocket: number; toSocket: number}>,
    dataframeNames: Map<string, string>
  ): string[] {
    const lines: string[] = [];
    const config = tool.config;
    const columnName = config.column_name || "";
    const expression = config.expression || "";
    
    if (inputs.length === 0) {
      lines.push(`# ERROR: Formula ${tool.id} has no input`);
      return lines;
    }
    
    const input = inputs[0]!; // Safe: length check above guarantees this exists
    const inputVar = dataframeNames.get(`${input.fromTool}_${input.fromSocket}`);
    if (!inputVar) {
      lines.push(`# ERROR: Formula ${tool.id} input not found`);
      return lines;
    }
    
    if (!columnName || !expression) {
      lines.push(`# ERROR: Formula ${tool.id} missing column_name or expression`);
      return lines;
    }
    
    const socketName = this.getSocketName(tool.type, 1, "output");
    const outputVar = this.buildVarName(tool.id, socketName);
    dataframeNames.set(`${tool.id}_1`, outputVar);
    
    lines.push(`${outputVar} = ${inputVar}.with_columns([`);
    lines.push(`    (${expression}).alias("${columnName}")`);
    lines.push(`])`);
    
    return lines;
  }
  
  /**
   * Generate code for Multiplier tool
   */
  private static generateMultiplierCode(
    tool: Tool,
    inputs: Array<{fromTool: string; fromSocket: number; toSocket: number}>,
    dataframeNames: Map<string, string>
  ): string[] {
    const lines: string[] = [];
    const config = tool.config;
    const column = config.column || "";
    const factor = config.factor || 1;
    
    if (inputs.length === 0) {
      lines.push(`# ERROR: Multiplier ${tool.id} has no input`);
      return lines;
    }
    
    const input = inputs[0]!; // Safe: length check above guarantees this exists
    const inputVar = dataframeNames.get(`${input.fromTool}_${input.fromSocket}`);
    if (!inputVar) {
      lines.push(`# ERROR: Multiplier ${tool.id} input not found`);
      return lines;
    }
    
    if (!column) {
      lines.push(`# ERROR: Multiplier ${tool.id} has no column specified`);
      return lines;
    }
    
    const socketName = this.getSocketName(tool.type, 1, "output");
    const outputVar = this.buildVarName(tool.id, socketName);
    dataframeNames.set(`${tool.id}_1`, outputVar);
    
    lines.push(`${outputVar} = ${inputVar}.with_columns([`);
    lines.push(`    (pl.col("${column}") * ${factor}).alias("${column}")`);
    lines.push(`])`);
    
    return lines;
  }
  
  /**
   * Build map of inputs for each tool
   */
  private static buildInputMap(wires: Wire[]): Map<string, Array<{fromTool: string; fromSocket: number; toSocket: number}>> {
    const map = new Map<string, Array<{fromTool: string; fromSocket: number; toSocket: number}>>();
    
    for (const wire of wires) {
      const toTool = wire.to.tool;
      if (!map.has(toTool)) {
        map.set(toTool, []);
      }
      map.get(toTool)!.push({
        fromTool: wire.from.tool,
        fromSocket: wire.from.socket,
        toSocket: wire.to.socket
      });
    }
    
    // Sort inputs by socket ID for consistent ordering
    for (const inputs of map.values()) {
      inputs.sort((a, b) => a.toSocket - b.toSocket);
    }
    
    return map;
  }
  
  /**
   * Topological sort to determine execution order
   */
  private static topologicalSort(tools: Tool[], wires: Wire[]): string[] {
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Initialize
    for (const tool of tools) {
      graph.set(tool.id, []);
      inDegree.set(tool.id, 0);
    }
    
    // Build adjacency list and in-degree counts
    for (const wire of wires) {
      graph.get(wire.from.tool)?.push(wire.to.tool);
      inDegree.set(wire.to.tool, (inDegree.get(wire.to.tool) || 0) + 1);
    }
    
    // Find nodes with no incoming edges
    const queue: string[] = [];
    for (const [toolId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(toolId);
      }
    }
    
    const result: string[] = [];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      const neighbors = graph.get(current) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }
    
    // If result doesn't contain all tools, there's a cycle
    return result.length === tools.length ? result : [];
  }
  
  /**
   * Sanitize tool ID for use as Python variable name
   */
  private static sanitizeVarName(id: string): string {
    return id.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
  }
  
  /**
   * Escape file path for Python string
   */
  private static escapePath(path: string): string {
    return path.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }
}
