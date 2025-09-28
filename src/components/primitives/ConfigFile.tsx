import { XMLEmissionMap } from "@domain/workflow/entities/workflow";
import React, { useId } from "react";
import { BrowserFileWarning } from "./BrowserFileWarning";
import { ConfigField } from "./ConfigField";
import { usePrimitiveEmission } from "./hooks";

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface ConfigFileProps {
  value: string | undefined;
  onChange: (
    value: string | undefined,
    emitPatch: XMLEmissionMap,
    shouldEmit: boolean
  ) => void;
  placeholder?: string;
  label?: string;
  description?: React.ReactNode;
  filters?: FileFilter[];
  accept?: string; // For browser fallback
  disabled?: boolean;
  showBrowserWarning?: boolean; // Whether to show browser limitation warning
  configKey: string;
  defaultValue?: string;
  inlineMessage?: React.ReactNode;
  required?: boolean;
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
  description,
  filters = [{ name: "All Files", extensions: ["*"] }],
  accept = "*",
  disabled = false,
  showBrowserWarning = true,
  defaultValue = "",
  inlineMessage,
  required = false,
}) => {
  const inputId = useId();
  const descriptionId = description ? `${inputId}-description` : undefined;

  const { shouldEmit, commit } = usePrimitiveEmission<string>({
    configKey,
    value,
    defaultValue,
    onChange,
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
          commit(filePath);
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
          commit(file.name);
        }
      };
      input.click();
    }
  };

  return (
    <ConfigField
      label={label}
      labelFor={inputId}
      description={description}
      descriptionId={descriptionId}
      willEmit={shouldEmit}
      inlineMessage={inlineMessage}
      required={required}
      className="space-y-3"
    >
      <div className="flex space-x-2">
        <input
          type="text"
          id={inputId}
          value={value ?? ""}
          onChange={(e) => {
            const nextValue = e.target.value;
            commit(nextValue);
          }}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={descriptionId}
          className="flex-1 px-3 py-2 text-sm border rounded-md border-theme-border-primary bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleBrowseClick}
          disabled={disabled}
          className="px-4 py-2 text-sm transition-colors border rounded-md bg-theme-surface-panel border-theme-border-primary text-theme-text-primary hover:bg-theme-surface-elevated focus:outline-none focus:ring-1 focus:ring-theme-border-focus disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Browse
        </button>
      </div>

      {/* Browser limitation warning */}
      {showBrowserWarning && <BrowserFileWarning className="mt-2" />}
    </ConfigField>
  );
};
