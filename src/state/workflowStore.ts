import { create } from 'zustand';
import { Tool, Wire, WorkflowMeta } from '@domain/workflow/entities/workflow';
import { Edge } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';

interface WorkflowState {
  tools: Tool[];
  wires: Wire[];
  edges: Edge[];
  workflowMeta: WorkflowMeta;
  selectedTool: Tool | null;
  setFromXML: (tools: Tool[], wires: Wire[], meta: WorkflowMeta) => void;
  setEdges: (edges: Edge[]) => void;
  setSelectedTool: (tool: Tool | null) => void;
  updateWorkflowMeta: (partial: Partial<Pick<WorkflowMeta, 'name' | 'description' | 'author'>>) => void;
  updateToolPositionLocal: (toolId: string, x: number, y: number) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  tools: [],
  wires: [],
  edges: [],
  workflowMeta: {
    name: 'New Workflow',
    description: 'A new workflow',
    author: 'SigilWeaver',
    workflowId: uuidv4(),
    created: new Date().toISOString(),
  },
  selectedTool: null,
  setFromXML: (tools, wires, meta) => set({ tools, wires, workflowMeta: meta }),
  setEdges: (edges) => set({ edges }),
  setSelectedTool: (selectedTool) => set({ selectedTool }),
  updateWorkflowMeta: (partial) => set((s) => ({ workflowMeta: { ...s.workflowMeta, ...partial } })),
  updateToolPositionLocal: (toolId, x, y) => set((s) => ({ tools: s.tools.map(t => t.id === toolId ? { ...t, x, y } : t) })),
}));
