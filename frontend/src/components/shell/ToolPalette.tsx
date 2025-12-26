import React from "react";
import { getToolsByCategory } from "@data/tools";
import { ToolCategory } from "@domain/workflow/entities/workflow";
import { useUIStore } from "@state/uiStore";
import { Star, ArrowRightLeft, Wrench, Link, BarChart3, ChevronDown, ChevronRight } from 'lucide-react';

const CATEGORIES: { id: ToolCategory; name: string; icon: React.ElementType }[] = [
  {
    id: "favorites",
    name: "Favorites",
    icon: Star,
  },
  { id: "inout", name: "In/Out", icon: ArrowRightLeft },
  {
    id: "preparation",
    name: "Preparation",
    icon: Wrench,
  },
  { id: "join", name: "Join", icon: Link },
  {
    id: "aggregate",
    name: "Aggregate",
    icon: BarChart3,
  },
];

const getCategoryColor = (category: string) => {
  switch (category) {
    case "favorites": return "var(--color-favorites)";
    case "inout": return "var(--color-tool-inout)";
    case "preparation": return "var(--color-tool-preparation)";
    case "join": return "var(--color-tool-join)";
    case "aggregate": return "var(--color-tool-aggregate)";
    default: return "var(--color-tool-default)";
  }
};

export default function ToolPalette() {
  const favoriteTools = useUIStore((s) => s.favoriteTools);
  const toggleFavoriteTool = useUIStore((s) => s.toggleFavoriteTool);
  const collapsedCategories = useUIStore((s) => s.collapsedCategories);
  const toggleCategory = useUIStore((s) => s.toggleCategory);

  const handleDragStart = (e: React.DragEvent, toolType: string) => {
    e.dataTransfer.setData("application/reactflow", toolType);
    e.dataTransfer.effectAllowed = "move";
  };

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
        const tools = category.id === 'favorites' 
          ? getToolsByCategory(category.id, favoriteTools)
          : getToolsByCategory(category.id);
        
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
                      : 'No tools in this category.'}
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
                            className="flex items-center justify-center p-2 transition-shadow border-2 rounded-lg shadow cursor-move select-none bg-theme-node-default-bg hover:shadow-lg"
                            style={{
                              width: "44px",
                              height: "44px",
                              borderColor: toolColor,
                            }}
                          >
                            <tool.icon className="w-6 h-6" style={{ color: toolColor }} />
                          </div>
                          {/* Tool label */}
                          <div
                            className="text-[8px] font-medium text-theme-text-primary text-center mt-0.5 px-1 py-0.5 rounded border max-w-[60px] truncate"
                            style={{
                              backgroundColor: "var(--color-surface-elevated)",
                              borderColor: toolColor,
                            }}
                            title={tool.name}
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
    </div>
  );
}
