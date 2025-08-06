import React from 'react';
import { ToolCategory } from '../types/workflow';
import { getToolsByCategory } from '../data/tools';

interface ToolPaletteProps {
  activeTab: ToolCategory;
  onTabChange: (tab: ToolCategory) => void;
}

const TABS: { id: ToolCategory; name: string; color: string; icon: string }[] = [
  { id: 'favorites', name: 'Favorites', color: 'bg-theme-tool-favorites', icon: '⭐' },
  { id: 'inout', name: 'In/Out', color: 'bg-theme-tool-inout', icon: '📁' },
  { id: 'preparation', name: 'Preparation', color: 'bg-theme-tool-preparation', icon: '🔧' },
  { id: 'join', name: 'Join', color: 'bg-theme-tool-join', icon: '🔗' },
  { id: 'aggregate', name: 'Aggregate', color: 'bg-theme-tool-aggregate', icon: '📊' },
];

export default function ToolPalette({ activeTab, onTabChange }: ToolPaletteProps) {
  const tools = getToolsByCategory(activeTab);

  const handleDragStart = (e: React.DragEvent, toolType: string) => {
    e.dataTransfer.setData('application/reactflow', toolType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="bg-theme-surface-elevated border-b-2 border-theme-border-secondary">
      {/* Tabs */}
      <div className="flex border-b-2 border-theme-border-secondary px-2 pt-2 relative">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-2 text-sm font-medium border-2 rounded-t-lg transition-colors flex items-center gap-2 mr-1 relative ${
              activeTab === tab.id
                ? `border-theme-border-secondary border-b-theme-surface-elevated bg-theme-surface-elevated text-theme-text-primary z-10`
                : 'border-theme-border-primary text-theme-text-tertiary hover:text-theme-text-secondary hover:border-theme-border-secondary bg-theme-surface-panel z-0'
            }`}
            style={{
              marginBottom: '-2px',
            }}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Tools */}
      <div className="p-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {tools.map((tool) => (
            <div
              key={tool.type}
              draggable
              onDragStart={(e) => handleDragStart(e, tool.type)}
              className="border-2 rounded-lg p-4 bg-theme-surface-elevated shadow-lg hover:shadow-xl transition-shadow select-none cursor-move flex items-center justify-center text-center"
              style={{
                width: '100px',  // Same as canvas tools
                height: '100px',
                borderColor: 
                  tool.category === 'inout' ? 'var(--color-tool-inout)' :
                  tool.category === 'preparation' ? 'var(--color-tool-preparation)' :
                  tool.category === 'join' ? 'var(--color-tool-join)' :
                  tool.category === 'aggregate' ? 'var(--color-tool-aggregate)' : 'var(--color-tool-default)',
              }}
            >
              <div>
                <div className="text-xl mb-1">{tool.icon}</div>
                <div className="text-xs font-medium text-theme-text-primary leading-tight">
                  {tool.name}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
