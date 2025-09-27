import { XMLEmissionMap } from "@domain/workflow/entities/workflow";
import React from "react";
import { BrowserFileWarning } from "./BrowserFileWarning";
import { useXMLEmission } from "./hooks";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface ConfigFileProps {
  value: string;
  onChange: (
    value: string,
    emitPatch: XMLEmissionMap,
    shouldEmit: boolean
  ) => void;
  placeholder?: string;
  label?: string;
  filters?: FileFilter[];
  accept?: string; // For browser fallback
  disabled?: boolean;
  showBrowserWarning?: boolean; // Whether to show browser limitation warning
  configKey: string;
  defaultValue?: string;
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
 *   configKey="filePath"
 *   accept=".csv,.tsv"
 * />
 *
 * // Excel files
 * <ConfigFile
 *   filters={[
 *     { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
 *     { name: 'All Files', extensions: ['*'] }
 *   ]}
 *   configKey="filePath"
 *   accept=".xlsx,.xls"
 * />
 */
export const ConfigFile: React.FC<ConfigFileProps> = ({
  value,
  onChange,
  configKey,
  placeholder = "Enter file path or click Browse...",
  label = "File Path",
  filters = [{ name: "All Files", extensions: ["*"] }],
  accept = "*",
  disabled = false,
  showBrowserWarning = true,
  defaultValue = "",
}) => {
  const { build, evaluate } = useXMLEmission<string>({
    configKey,
    value,
    defaultValue,
  });

  const handleBrowseClick = async () => {
    if (disabled) return;

    // Use Electron's file dialog if available
    if (window.electronAPI?.showOpenDialog) {
      try {
        const filePath = await window.electronAPI.showOpenDialog({
          filters: filters,
        });
        if (filePath) {
          const nextShouldEmit = evaluate(filePath);
          const emitPatch = build(nextShouldEmit);
          onChange(filePath, emitPatch, nextShouldEmit);
        }
      } catch (error) {
        console.error("Error opening file dialog:", error);
      }
    } else {
      // Fallback for web browser
      const input = document.createElement("input");
      input.type = "file";
      input.accept = accept;
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          // In browser, we can only get the file name
          const nextShouldEmit = evaluate(file.name);
          const emitPatch = build(nextShouldEmit);
          onChange(file.name, emitPatch, nextShouldEmit);
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
          onChange={(e) => {
            const nextValue = e.target.value;
            const nextShouldEmit = evaluate(nextValue);
            const emitPatch = build(nextShouldEmit);
            onChange(nextValue, emitPatch, nextShouldEmit);
          }}
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
      {showBrowserWarning && <BrowserFileWarning className="mt-2" />}
    </div>
  );
};
