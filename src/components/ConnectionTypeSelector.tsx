import { useState } from 'react';
import { ConnectionType } from '../types/configuration';

interface ConnectionTypeSelectorProps {
  availableTypes: ConnectionType[];
  selectedType: ConnectionType | null;
  onTypeSelect: (type: ConnectionType) => void;
}

export default function ConnectionTypeSelector({
  availableTypes,
  selectedType,
  onTypeSelect
}: ConnectionTypeSelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<'file' | 'database' | ''>('');
  
  // Group types by category
  const fileTypes = availableTypes.filter(type => type.category === 'file');
  const databaseTypes = availableTypes.filter(type => type.category === 'database');

  // Get available types for selected category
  const getTypesForCategory = (category: 'file' | 'database') => {
    return category === 'file' ? fileTypes : databaseTypes;
  };

  const handleCategoryChange = (category: 'file' | 'database' | '') => {
    setSelectedCategory(category);
    // Reset selected type when category changes
    if (selectedType && category !== selectedType.category) {
      // Could clear selection here if needed
    }
  };

  const handleTypeSelect = (type: ConnectionType) => {
    onTypeSelect(type);
  };

  return (
    <div className="space-y-4">
      {/* Step 1: Category Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Data Source Category
        </label>
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value as 'file' | 'database' | '')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select a category...</option>
          {fileTypes.length > 0 && (
            <option value="file">📁 File Sources</option>
          )}
          {databaseTypes.length > 0 && (
            <option value="database">🗄️ Database Sources</option>
          )}
        </select>
      </div>

      {/* Step 2: Type Selection (only show if category is selected) */}
      {selectedCategory && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {selectedCategory === 'file' ? 'File Type' : 'Database Type'}
          </label>
          <select
            value={selectedType?.id || ''}
            onChange={(e) => {
              const type = getTypesForCategory(selectedCategory).find(t => t.id === e.target.value);
              if (type) handleTypeSelect(type);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a {selectedCategory === 'file' ? 'file type' : 'database type'}...</option>
            {getTypesForCategory(selectedCategory).map(type => (
              <option 
                key={type.id} 
                value={type.id}
                disabled={!type.isImplemented}
              >
                {type.displayName}
                {!type.isImplemented && ' (Coming Soon)'}
                {type.extensions && ` (${type.extensions.join(', ')})`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Selected Type Summary */}
      {selectedType && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm text-blue-900">{selectedType.displayName}</div>
              {selectedType.extensions && (
                <div className="text-xs text-blue-700 mt-1">
                  Supported: {selectedType.extensions.join(', ')}
                </div>
              )}
            </div>
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          </div>
        </div>
      )}
    </div>
  );
}
