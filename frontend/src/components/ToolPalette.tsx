import React from "react";
import { getToolsByCategory } from "../data/tools";
import { ToolCategory } from "../domain/workflow/entities/workflow";
import { useUIStore } from "../state/uiStore";

const TABS: { id: ToolCategory; name: string; color: string; icon: string }[] =
  [
    {
      id: "favorites",
      name: "Favorites",
      color: "bg-theme-tool-favorites",
      icon: "⭐",
    },
    { id: "inout", name: "In/Out", color: "bg-theme-tool-inout", icon: "📁" },
    {
      id: "preparation",
      name: "Preparation",
      color: "bg-theme-tool-preparation",
      icon: "🔧",
    },
    { id: "join", name: "Join", color: "bg-theme-tool-join", icon: "🔗" },
    {
      id: "aggregate",
      name: "Aggregate",
      color: "bg-theme-tool-aggregate",
      icon: "📊",
    },
  ];

export default function ToolPalette() {
  const activeTab = useUIStore((s) => s.activeToolTab);
  const setActiveTab = useUIStore((s) => s.setActiveToolTab);

  const tools = getToolsByCategory(activeTab);

  const handleDragStart = (e: React.DragEvent, toolType: string) => {
    e.dataTransfer.setData("application/reactflow", toolType);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="bg-theme-surface-elevated border-b-2 border-theme-border-secondary">
      {/* Tabs */}
      <div
        className="flex border-b-2 border-theme-border-primary px-2 pt-2 relative"
        role="tablist"
        aria-label="Tool categories"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`px-3 py-2 text-sm font-medium border-2 rounded-t-lg transition-colors flex items-center gap-2 mr-1 relative ${
              activeTab === tab.id
                ? "bg-theme-surface-elevated text-theme-text-primary border-theme-border-primary border-b-theme-surface-elevated z-20 shadow-sm"
                : "bg-theme-surface-panel text-theme-text-tertiary hover:text-theme-text-secondary z-0"
            }`}
            style={{
              marginBottom: "-2px",
              // Use the exact separator color (same as the tablist bottom border)
              borderColor: "var(--color-border-primary)",
            }}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Tools */}
      <div className="p-2 overflow-x-auto">
        <div className="flex gap-3 min-w-max">
          {tools.map((tool) => {
            const categoryColor =
              tool.category === "inout"
                ? "var(--color-tool-inout)"
                : tool.category === "preparation"
                  ? "var(--color-tool-preparation)"
                  : tool.category === "join"
                    ? "var(--color-tool-join)"
                    : tool.category === "aggregate"
                      ? "var(--color-tool-aggregate)"
                      : "var(--color-tool-default)";

            return (
              <div
                key={tool.type}
                className="flex flex-col items-center"
              >
                {/* Tool node - matches canvas styling */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, tool.type)}
                  className="border-2 rounded-lg p-3 bg-theme-node-default-bg shadow-lg hover:shadow-xl transition-shadow select-none cursor-move flex items-center justify-center"
                  style={{
                    width: "60px",
                    height: "60px",
                    borderColor: categoryColor,
                  }}
                >
                  <div className="text-2xl">{tool.icon}</div>
                </div>
                {/* Tool label - below node, matches canvas styling */}
                <div
                  className="text-[10px] font-medium text-theme-text-primary text-center mt-1 px-1.5 py-0.5 rounded border max-w-[80px] truncate"
                  style={{
                    backgroundColor: "var(--color-surface-elevated)",
                    borderColor: categoryColor,
                  }}
                  title={tool.name}
                >
                  {tool.name}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
