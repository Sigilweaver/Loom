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
];

export default function ToolPalette({ activeTab, onTabChange }: ToolPaletteProps) {
  const tools = getToolsByCategory(activeTab);

  const handleDragStart = (e: React.DragEvent, toolType: string) => {
    e.dataTransfer.setData('application/reactflow', toolType);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="bg-white border-b border-gray-200">
      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? `${tab.color} text-white border-transparent`
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
      </div>

      {/* Tools */}
      <div className="p-3">
        <div className="grid grid-cols-6 gap-3">
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
                  tool.category === 'join' ? '#8b5cf6' : '#6b7280',
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
