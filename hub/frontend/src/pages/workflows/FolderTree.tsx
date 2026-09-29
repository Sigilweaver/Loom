import { useState } from "react";
import clsx from "clsx";
import { ChevronRight, Folder, FolderOpen, Home } from "lucide-react";
import { Select } from "@components/ui";
import { flattenFolders, type FolderNode } from "./folders";

interface FolderTreeProps {
  root: FolderNode;
  selectedPath: string;
  onSelect: (path: string) => void;
}

interface FolderTreeItemProps {
  node: FolderNode;
  selectedPath: string;
  onSelect: (path: string) => void;
  depth?: number;
}

function FolderTreeItem({ node, selectedPath, onSelect, depth = 0 }: FolderTreeItemProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const selected = selectedPath === node.path;
  const hasChildren = node.children.length > 0;
  const Icon = depth === 0 ? Home : hasChildren && expanded ? FolderOpen : Folder;

  return (
    <li>
      <div
        className={clsx(
          "flex items-center rounded-lg text-sm transition-colors",
          selected ? "bg-accent-soft text-accent-ink" : "text-ink-muted hover:bg-surface-hover"
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            aria-label={`${expanded ? "Collapse" : "Expand"} ${node.name}`}
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 hover:bg-line"
          >
            <ChevronRight className={clsx("h-3 w-3 text-ink-faint transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-5" aria-hidden="true" />
        )}
        <button
          type="button"
          aria-current={selected ? "true" : undefined}
          onClick={() => {
            onSelect(node.path);
            if (hasChildren) setExpanded(true);
          }}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2 text-left"
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate">{node.name}</span>
          <span className="text-xs text-ink-faint">{node.count}</span>
        </button>
      </div>
      {hasChildren && expanded && (
        <ul>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.path}
              node={child}
              selectedPath={selectedPath}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Folder navigation shown beside the workflow list on wide screens. */
export function FolderTree({ root, selectedPath, onSelect }: FolderTreeProps) {
  return (
    <nav aria-label="Folders">
      <h2 className="mb-3 text-xs font-semibold tracking-wider text-ink-subtle uppercase">Folders</h2>
      <ul>
        <FolderTreeItem node={root} selectedPath={selectedPath} onSelect={onSelect} />
      </ul>
    </nav>
  );
}

/** Compact folder picker for narrow screens, where the tree has no room. */
export function FolderSelect({ root, selectedPath, onSelect }: FolderTreeProps) {
  return (
    <Select aria-label="Folder" value={selectedPath} onChange={(e) => onSelect(e.target.value)}>
      {flattenFolders(root).map((row) => (
        <option key={row.path} value={row.path}>
          {`${"  ".repeat(row.depth)}${row.label}`}
        </option>
      ))}
    </Select>
  );
}
