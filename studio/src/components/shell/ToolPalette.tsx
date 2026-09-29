import React, { useRef, useCallback, useState } from "react";
import { getToolsByCategory } from "@data/tools";
import { ToolCategory } from "@domain/workflow/entities/workflow";
import { useUIStore } from "@state/uiStore";
import { useSettingsStore } from "@state/settingsStore";
import { setDragToolType } from '@components/canvas/CanvasDragAndDropLayer';
import { Star, ArrowRightLeft, Wrench, Link, BarChart3, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

const CATEGORIES: { id: ToolCategory; name: string; icon: React.ElementType }[] = [
  {
    id: "favorites",
    name: "Favorites",
    icon: Star,
  },
  { id: "connect", name: "Connect", icon: ArrowRightLeft },
  {
    id: "compute",
    name: "Compute",
    icon: Wrench,
  },
  { id: "reshape", name: "Reshape", icon: BarChart3 },
  {
    id: "combine",
    name: "Combine",
    icon: Link,
  },
];

const getCategoryColor = (category: string) => {
  switch (category) {
    case "favorites": return "var(--color-favorites)";
    case "connect": return "var(--color-tool-connect)";
    case "compute": return "var(--color-tool-compute)";
    case "reshape": return "var(--color-tool-reshape)";
    case "combine": return "var(--color-tool-combine)";
    default: return "var(--color-tool-default)";
  }
};

// Custom event for touch drag - dispatched when tool is dropped on canvas
export const TOOL_TOUCH_DROP_EVENT = 'loom:tool-touch-drop';

export interface ToolTouchDropDetail {
  toolType: string;
  clientX: number;
  clientY: number;
}

export default function ToolPalette() {
  const favoriteTools = useUIStore((s) => s.favoriteTools);
  const toggleFavoriteTool = useUIStore((s) => s.toggleFavoriteTool);
  const collapsedCategories = useUIStore((s) => s.collapsedCategories);
  const toggleCategory = useUIStore((s) => s.toggleCategory);
  const showBlockingIndicators = useSettingsStore((s) => s.ui.showBlockingIndicators);

  // Touch drag state
  const [touchDragTool, setTouchDragTool] = useState<string | null>(null);
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragThreshold = 10; // Pixels before drag starts

  const handleDragStart = (e: React.DragEvent, toolType: string) => {
    e.dataTransfer.setData("application/reactflow", toolType);
    e.dataTransfer.effectAllowed = "move";
    // Expose tool type for auto-connect preview (can't read getData during dragover)
    setDragToolType(toolType);
  };

  const handleTouchStart = useCallback((e: React.TouchEvent, _toolType: string) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      // Don't start drag immediately - wait for movement past threshold
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent, toolType: string) => {
    const touch = e.touches[0];
    if (!touch || !touchStartRef.current) return;

    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Start drag after threshold
    if (distance > dragThreshold) {
      if (!touchDragTool) {
        setTouchDragTool(toolType);
      }
      setTouchPosition({ x: touch.clientX, y: touch.clientY });
      // Prevent scrolling while dragging
      e.preventDefault();
    }
  }, [touchDragTool]);

  const handleTouchEnd = useCallback((_e: React.TouchEvent) => {
    if (touchDragTool && touchPosition) {
      // Dispatch custom event for canvas to handle
      const event = new CustomEvent(TOOL_TOUCH_DROP_EVENT, {
        detail: {
          toolType: touchDragTool,
          clientX: touchPosition.x,
          clientY: touchPosition.y,
        } as ToolTouchDropDetail,
        bubbles: true,
      });
      document.dispatchEvent(event);
    }
    
    // Reset state
    setTouchDragTool(null);
    setTouchPosition(null);
    touchStartRef.current = null;
  }, [touchDragTool, touchPosition]);

  // Cancel drag on touchcancel
  const handleTouchCancel = useCallback(() => {
    setTouchDragTool(null);
    setTouchPosition(null);
    touchStartRef.current = null;
  }, []);

  const handleToggleFavorite = (e: React.MouseEvent, toolType: string) => {
    e.stopPropagation();
    e.preventDefault();
    toggleFavoriteTool(toolType);
  };

  return (
    <div className="h-full overflow-y-auto bg-theme-surface-panel">
      {/* Drag hint */}
      <div className="px-3 py-2 text-xs border-b text-theme-text-tertiary border-theme-border-primary bg-theme-surface-elevated">
        Drag tools to the canvas to build your workflow
      </div>
      
      {CATEGORIES.map((category) => {
        // Each tool appears once: favorites are listed only in the Favorites
        // section and are omitted from their regular category.
        const tools = category.id === 'favorites'
          ? getToolsByCategory(category.id, favoriteTools)
          : getToolsByCategory(category.id).filter((tool) => !favoriteTools.includes(tool.type));
        
        const categoryColor = getCategoryColor(category.id);
        const isCollapsed = collapsedCategories.includes(category.id);

        return (
          <div key={category.id} className="border-b border-theme-border-primary last:border-b-0">
            {/* Category Subheader - Clickable to collapse/expand */}
            <button
              onClick={() => toggleCategory(category.id)}
              className="flex items-center w-full gap-2 px-3 py-2 text-xs font-semibold tracking-wide uppercase transition-colors bg-theme-surface-elevated text-theme-text-secondary hover:bg-theme-surface-hover"
              style={{ borderLeftWidth: '3px', borderLeftColor: categoryColor }}
              aria-expanded={!isCollapsed}
              aria-controls={`category-${category.id}-content`}
            >
              {isCollapsed ? (
                <ChevronRight className="w-3.5 h-3.5 text-theme-text-tertiary" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-theme-text-tertiary" />
              )}
              <category.icon className="w-3.5 h-3.5" style={{ color: categoryColor }} />
              <span>{category.name}</span>
              <span className="font-normal text-theme-text-disabled">({tools.length})</span>
            </button>

            {/* Tools Grid - Collapsible */}
            {!isCollapsed && (
              <div id={`category-${category.id}-content`} className="px-3 py-2">
                {tools.length === 0 ? (
                  <div className="py-2 text-xs italic text-theme-text-tertiary">
                    {category.id === 'favorites' 
                      ? 'Click the star on any tool to add it here.'
                      : 'All tools in this category are in Favorites.'}
                  </div>
                ) : (
                  <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))' }}>
                    {tools.map((tool) => {
                      const toolColor = getCategoryColor(tool.category);
                      const isFavorite = favoriteTools.includes(tool.type);

                      return (
                        <div
                          key={tool.type}
                          className="relative flex flex-col items-center group"
                        >
                          {/* Favorite star button */}
                          <button
                            onClick={(e) => handleToggleFavorite(e, tool.type)}
                            className={`absolute -top-1 -right-1 z-10 p-0.5 rounded-full transition-all ${
                              isFavorite 
                                ? 'text-theme-favorites opacity-100' 
                                : 'text-theme-text-tertiary opacity-0 group-hover:opacity-100 hover:text-theme-favorites'
                            }`}
                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            aria-label={isFavorite ? `Remove ${tool.name} from favorites` : `Add ${tool.name} to favorites`}
                          >
                            <Star 
                              className="w-3.5 h-3.5" 
                              fill={isFavorite ? 'currentColor' : 'none'} 
                            />
                          </button>

                          {/* Tool node */}
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, tool.type)}
                            onDragEnd={() => setDragToolType(null)}
                            onTouchStart={(e) => handleTouchStart(e, tool.type)}
                            onTouchMove={(e) => handleTouchMove(e, tool.type)}
                            onTouchEnd={handleTouchEnd}
                            onTouchCancel={handleTouchCancel}
                            className="relative flex items-center justify-center p-2 transition-shadow border-2 rounded-lg shadow cursor-move select-none bg-theme-node-default-bg hover:shadow-lg touch-none"
                            style={{
                              width: "44px",
                              height: "44px",
                              borderColor: toolColor,
                            }}
                          >
                            <tool.icon className="w-6 h-6" style={{ color: toolColor }} />
                            {tool.blocking && showBlockingIndicators && (
                              <AlertTriangle
                                className="absolute w-2.5 h-2.5 bottom-0.5 right-0.5 opacity-50"
                                style={{ color: 'var(--color-warning)' }}
                                aria-label="Blocking operation"
                              />
                            )}
                          </div>
                          {/* Tool label */}
                          <div
                            className="text-[8px] font-medium text-theme-text-primary text-center mt-0.5 px-1 py-0.5 rounded border max-w-[60px] truncate"
                            style={{
                              backgroundColor: "var(--color-surface-elevated)",
                              borderColor: toolColor,
                            }}
                            title={tool.blocking && showBlockingIndicators ? `${tool.name} (blocking operation - breaks lazy evaluation)` : tool.name}
                          >
                            {tool.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Touch drag ghost indicator */}
      {touchDragTool && touchPosition && (
        <div
          style={{
            position: 'fixed',
            left: touchPosition.x - 22,
            top: touchPosition.y - 22,
            width: 44,
            height: 44,
            pointerEvents: 'none',
            zIndex: 10000,
            opacity: 0.8,
          }}
          className="flex items-center justify-center p-2 border-2 rounded-lg shadow-lg bg-theme-node-default-bg border-theme-border-accent"
        >
          {(() => {
            const tool = [...getToolsByCategory('connect'), ...getToolsByCategory('compute'), ...getToolsByCategory('reshape'), ...getToolsByCategory('combine')].find(t => t.type === touchDragTool);
            if (tool) {
              const ToolIcon = tool.icon;
              return <ToolIcon className="w-6 h-6" style={{ color: getCategoryColor(tool.category) }} />;
            }
            return null;
          })()}
        </div>
      )}
    </div>
  );
}
