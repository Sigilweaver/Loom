import React from 'react';
import { ToolCategory } from '../types/workflow';
import { getToolsByCategory } from '../data/tools';

interface ToolPaletteProps {
  activeTab: ToolCategory;
  onTabChange: (tab: ToolCategory) => void;
}

const TABS: { id: ToolCategory; name: string; color: string }[] = [
  { id: 'favorites', name: 'Favorites', color: 'bg-yellow-500' },
  { id: 'inout', name: 'In/Out', color: 'bg-tool-inout' },
  { id: 'preparation', name: 'Preparation', color: 'bg-tool-preparation' },
  { id: 'join', name: 'Join', color: 'bg-tool-join' },
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
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? `${tab.color} text-white border-transparent`
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {/* Tools */}
      <div className="p-4">
        <div className="grid grid-cols-6 gap-4">
          {tools.map((tool) => (
            <div
              key={tool.type}
              draggable
              onDragStart={(e) => handleDragStart(e, tool.type)}
              className="flex flex-col items-center p-3 bg-gray-50 rounded-lg cursor-move hover:bg-gray-100 transition-colors border border-gray-200"
            >
              <div className="text-2xl mb-2">{tool.icon}</div>
              <div className="text-xs text-center text-gray-700 font-medium">
                {tool.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
