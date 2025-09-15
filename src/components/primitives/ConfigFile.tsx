import React from 'react';
import { BrowserFileWarning } from './BrowserFileWarning';

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface ConfigFileProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  filters?: FileFilter[];
  accept?: string; // For browser fallback
  disabled?: boolean;
  showBrowserWarning?: boolean; // Whether to show browser limitation warning
}



/**
 * Simple file path input primitive with browse dialog support
 * No business logic - just handles file selection UI
 * 
 * @example
 * // CSV files only
 * <ConfigFile 
 *   filters={[
 *     { name: 'CSV Files', extensions: ['csv', 'tsv'] },
 *     { name: 'All Files', extensions: ['*'] }
 *   ]} 
 *   accept=".csv,.tsv" 
 * />
 * 
 * // Excel files
 * <ConfigFile 
 *   filters={[
 *     { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
 *     { name: 'All Files', extensions: ['*'] }
 *   ]} 
 *   accept=".xlsx,.xls" 
 * />
 */
export const ConfigFile: React.FC<ConfigFileProps> = ({
  value,
  onChange,
  placeholder = "Enter file path or click Browse...",
  label = "File Path",
  filters = [{ name: 'All Files', extensions: ['*'] }],
  accept = "*",
  disabled = false,
  showBrowserWarning = true
}) => {
  
  const handleBrowseClick = async () => {
    if (disabled) return;
    
    // Use Electron's file dialog if available
    if (window.electronAPI?.showOpenDialog) {
      try {
        const filePath = await window.electronAPI.showOpenDialog({
          filters: filters
        });
        if (filePath) {
          onChange(filePath);
        }
      } catch (error) {
        console.error('Error opening file dialog:', error);
      }
    } else {
      // Fallback for web browser
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          // In browser, we can only get the file name
          onChange(file.name);
        }
      };
      input.click();
    }
  };

  return (
    <div>
      <label className="block text-sm font-medium text-theme-text-secondary mb-2">
        {label}
      </label>
      <div className="flex space-x-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1 px-3 py-2 border border-theme-border-primary rounded-md text-sm 
                     bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                     focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleBrowseClick}
          disabled={disabled}
          className="px-4 py-2 bg-theme-surface-panel border border-theme-border-primary rounded-md text-sm
                     text-theme-text-primary hover:bg-theme-surface-elevated transition-colors
                     focus:outline-none focus:ring-1 focus:ring-theme-border-focus
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Browse
        </button>
      </div>
      
      {/* Browser limitation warning */}
      {showBrowserWarning && (
        <BrowserFileWarning className="mt-2" />
      )}
    </div>
  );
};