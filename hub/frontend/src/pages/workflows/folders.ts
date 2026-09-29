/** Virtual folder helpers for the workflows list. */

import type { WorkflowMetadata } from "@api";

export interface FolderNode {
  name: string;
  /** Empty string for the root ("All workflows"). */
  path: string;
  children: FolderNode[];
  /** Workflows stored directly in this folder (the root counts all workflows). */
  count: number;
}

/** Build a tree of folders from the flat folder paths on the workflows. */
export function buildFolderTree(workflows: WorkflowMetadata[]): FolderNode {
  const root: FolderNode = { name: "All workflows", path: "", children: [], count: workflows.length };

  const counts = new Map<string, number>();
  for (const workflow of workflows) {
    counts.set(workflow.folder_path, (counts.get(workflow.folder_path) ?? 0) + 1);
  }

  for (const folderPath of [...counts.keys()].sort()) {
    if (folderPath === "/") continue; // Workflows in the root folder only appear under "All workflows".

    let current = root;
    let currentPath = "";
    for (const part of folderPath.split("/").filter(Boolean)) {
      currentPath += `/${part}`;
      let child = current.children.find((c) => c.name === part);
      if (!child) {
        child = { name: part, path: currentPath, children: [], count: 0 };
        current.children.push(child);
      }
      current = child;
    }
    current.count = counts.get(folderPath) ?? 0;
  }

  return root;
}

/** Flatten the tree into `{ path, label, depth }` rows, for a plain select on small screens. */
export function flattenFolders(root: FolderNode): { path: string; label: string; depth: number }[] {
  const rows: { path: string; label: string; depth: number }[] = [];
  const visit = (node: FolderNode, depth: number) => {
    rows.push({ path: node.path, label: node.name, depth });
    node.children.forEach((child) => visit(child, depth + 1));
  };
  visit(root, 0);
  return rows;
}

/**
 * Is a workflow's folder the selected folder or inside it? "/ml" contains
 * "/ml" and "/ml/models" but not "/ml-ops". An empty selection matches all.
 */
export function isInFolder(folderPath: string, selected: string): boolean {
  if (!selected) return true;
  return folderPath === selected || folderPath.startsWith(`${selected}/`);
}
