/**
 * CanvasComments — renders tool labels + comments as a viewport-space overlay.
 *
 * Instead of embedding comment text inside the React Flow node (which constrains
 * it to the node's 60×60 bounding box), we render labels + comments in a separate
 * layer that applies the same viewport transform. This means:
 *   - Text zooms/pans with the canvas naturally
 *   - No overflow/clipping fights with React Flow's node wrapper
 *   - Width, height, and alignment settings work without constraint
 *   - The minimap only sees the 60×60 node rectangles (not the text)
 */

import { memo, useMemo } from 'react';
import { useNodes, useViewport } from '@xyflow/react';
import { useSettingsStore } from '@state/settingsStore';
import { generateComment } from '@domain/workflow/services/commentGenerator';
import type { Tool, ToolDefinition } from '@domain/workflow/entities/workflow';

const NODE_SIZE = 60;
const LABEL_GAP = 4; // px gap between node bottom and label top

interface NodeData {
  tool: Tool;
  definition: ToolDefinition;
}

/** Resolve displayed comment for a tool */
function resolveComment(tool: Tool, visible: boolean): string | null {
  if (!visible) return null;
  if (tool.comment === '') return null;
  if (tool.comment !== undefined) return tool.comment;
  const auto = generateComment(tool.type, tool.config);
  return auto || null;
}

/** Category → border color mapping (mirrors WorkflowNode) */
function getCategoryColor(category: string): string {
  switch (category) {
    case 'connect': return 'var(--color-tool-connect)';
    case 'compute': return 'var(--color-tool-compute)';
    case 'reshape': return 'var(--color-tool-reshape)';
    case 'combine': return 'var(--color-tool-combine)';
    default: return 'var(--color-tool-default)';
  }
}

/** Single tool label + comment */
const ToolLabel = memo(function ToolLabel({
  x,
  y,
  name,
  comment,
  categoryColor,
  maxWidth,
  maxHeight,
  alignment,
}: {
  x: number;
  y: number;
  name: string;
  comment: string | null;
  categoryColor: string;
  maxWidth: number;
  maxHeight: number;
  alignment: 'left' | 'center' | 'right';
}) {
  return (
    <div
      style={{
        position: 'absolute',
        // Center the label horizontally on the node
        left: x + NODE_SIZE / 2,
        top: y + NODE_SIZE + LABEL_GAP,
        transform: 'translateX(-50%)',
        // Sizing
        width: comment ? maxWidth : undefined,
        maxWidth: maxWidth,
        minWidth: NODE_SIZE,
        // Appearance
        backgroundColor: 'var(--color-surface-elevated)',
        borderColor: categoryColor,
        borderWidth: 1,
        borderStyle: 'solid',
        borderRadius: 4,
        padding: '2px 6px',
        pointerEvents: 'none',
      }}
      title={comment ? `${name}\n${comment}` : name}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 500,
          textAlign: 'center',
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </div>
      {comment && (
        <div
          style={{
            fontSize: 9,
            lineHeight: 1.3,
            color: 'var(--color-text-tertiary)',
            textAlign: alignment,
            maxHeight: maxHeight,
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {comment}
        </div>
      )}
    </div>
  );
});

function CanvasComments() {
  const nodes = useNodes();
  const viewport = useViewport();
  const commentsSettings = useSettingsStore((s) => s.comments);

  // Build label data from nodes — memo to avoid recalc on unrelated re-renders
  const labels = useMemo(() => {
    return nodes.map((node) => {
      const { tool, definition } = node.data as unknown as NodeData;
      const comment = resolveComment(tool, commentsSettings.visible);
      return {
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        name: definition.name,
        comment,
        categoryColor: getCategoryColor(definition.category),
      };
    });
  }, [nodes, commentsSettings.visible]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        // Apply the same viewport transform as React Flow's node layer
        // so our labels zoom/pan in sync with nodes
        transformOrigin: '0 0',
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        pointerEvents: 'none',
        zIndex: 5, // above background dots, below nodes (nodes are z-index 0+ individually)
      }}
    >
      {labels.map((label) => (
        <ToolLabel
          key={label.id}
          x={label.x}
          y={label.y}
          name={label.name}
          comment={label.comment}
          categoryColor={label.categoryColor}
          maxWidth={commentsSettings.maxWidth}
          maxHeight={commentsSettings.maxHeight}
          alignment={commentsSettings.alignment}
        />
      ))}
    </div>
  );
}

export default memo(CanvasComments);
