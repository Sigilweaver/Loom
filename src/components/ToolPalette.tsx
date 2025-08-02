import React from 'react';
import { ToolCategory } from '../types/workflow';
import { getToolsByCategory } from '../data/tools';

interface ToolPaletteProps {
  activeTab: ToolCategory;
  onTabChange: (tab: ToolCategory) => void;
}

const TABS: { id: ToolCategory; name: string; color: string; icon: string }[] = [
  { id: 'favorites', name: 'Favorites', color: 'bg-yellow-500', icon: '⭐' },
  { id: 'inout', name: 'In/Out', color: 'bg-tool-inout', icon: '📁' },
  { id: 'preparation', name: 'Preparation', color: 'bg-tool-preparation', icon: '🔧' },
  { id: 'join', name: 'Join', color: 'bg-tool-join', icon: '🔗' },
  { id: 'aggregate', name: 'Aggregate', color: 'bg-tool-aggregate', icon: '📊' },
];

export default function ToolPalette({ activeTab, onTabChange }: ToolPaletteProps) {
  const tools = getToolsByCategory(activeTab);

  const handleDragStart = (e: React.DragEvent, toolType: string) => {
    e.dataTransfer.setData('application/reactflow', toolType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="bg-white border-b-2 border-gray-400">
      {/* Tabs */}
      <div className="flex border-b-2 border-gray-400 px-2 pt-2 relative">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-2 text-sm font-medium border-2 rounded-t-lg transition-colors flex items-center gap-2 mr-1 relative ${
              activeTab === tab.id
                ? `border-gray-400 border-b-white bg-white text-gray-800 z-10`
                : 'border-gray-300 text-gray-500 hover:text-gray-700 hover:border-gray-400 bg-gray-50 z-0'
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
              className="border-2 rounded-lg p-4 bg-white shadow-lg hover:shadow-xl transition-shadow select-none cursor-move flex items-center justify-center text-center"
              style={{
                width: '100px',  // Same as canvas tools
                height: '100px',
                borderColor: 
                  tool.category === 'inout' ? '#10b981' :
                  tool.category === 'preparation' ? '#3b82f6' :
                  tool.category === 'join' ? '#8b5cf6' :
                  tool.category === 'aggregate' ? '#f97316' : '#6b7280',
              }}
            >
              <div>
                <div className="text-xl mb-1">{tool.icon}</div>
                <div className="text-xs font-medium text-gray-700 leading-tight">
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
