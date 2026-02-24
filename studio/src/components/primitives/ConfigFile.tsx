import { EmissionMap } from "@domain/workflow/entities/workflow";
import React, { useId, useState, useCallback } from "react";
import { platform } from "@platform";
import { BrowserFileWarning } from "./BrowserFileWarning";
import { ConfigField } from "./ConfigField";
import { usePrimitiveEmission } from "./hooks";
import { useSettingsStore } from "@state/settingsStore";
import { getHubClient, hasHubClient, initHubClient } from "../../api/hub";
import { getSessionToken } from "../../api/backend";
import { RemoteFileBrowser } from "../common/RemoteFileBrowser";
import { Globe } from "lucide-react";
import { createLogger } from "@utils/logger";

const logger = createLogger("ConfigFile");

export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface ConfigFileProps {
  value: string | undefined;
  onChange: (
    value: string | undefined,
    emitPatch: EmissionMap,
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
  mode?: "open" | "save"; // Whether to open existing file or save new file
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
  mode = "open", // Default to opening existing files
}) => {
  const inputId = useId();
  const descriptionId = description ? `${inputId}-description` : undefined;

  // Remote file browser state
  const [remoteBrowserOpen, setRemoteBrowserOpen] = useState(false);

  // Check if remote browsing is available (hub or external mode)
  const executionMode = useSettingsStore((s) => s.executionMode);
  const backendUrl = useSettingsStore((s) => s.backend.url);
  const isRemoteModeAvailable = executionMode === "hub" || executionMode === "external";

  const { shouldEmit, commit } = usePrimitiveEmission<string>({
    configKey,
    value,
    defaultValue,
    onChange,
  });

  // Get hub settings for client restoration
  const hubUrl = useSettingsStore((s) => s.hub.url);
  const hubSessionToken = useSettingsStore((s) => s.hub.sessionToken);

  // Handle remote browse button click - just opens the dialog
  // Tokens are now fetched per-operation by the RemoteFileBrowser
  const handleRemoteBrowseClick = useCallback(() => {
    if (disabled) return;
    setRemoteBrowserOpen(true);
  }, [disabled]);

  // Get token function for RemoteFileBrowser - fetches fresh token for each operation
  const getRemoteBrowseToken = useCallback(async (): Promise<{ token: string; serverUrl: string }> => {
    if (executionMode === "hub") {
      // Hub mode: get browse token from Hub
      // Restore client from settings if it was lost (e.g., HMR reload)
      if (!hasHubClient() && hubSessionToken && hubUrl) {
        logger.info("Restoring HubClient from settings");
        initHubClient({ url: hubUrl, sessionToken: hubSessionToken });
      }
      if (!hasHubClient()) {
        throw new Error("Hub client not available");
      }
      const hubClient = getHubClient();
      // Request server token - Hub picks a healthy server for us
      const tokenResponse = await hubClient.requestToken();
      return {
        token: tokenResponse.token,
        serverUrl: tokenResponse.server_endpoint,
      };
    } else if (executionMode === "external") {
      // External mode: use session token directly
      const token = getSessionToken();
      if (!token) {
        throw new Error("No session token available for external server");
      }
      return {
        token,
        serverUrl: backendUrl,
      };
    }
    throw new Error(`Unsupported execution mode: ${executionMode}`);
  }, [executionMode, backendUrl, hubUrl, hubSessionToken]);

  const handleRemoteSelect = useCallback(
    (path: string) => {
      commit(path);
      setRemoteBrowserOpen(false);
    },
    [commit]
  );

  // Extract file extensions from filters for remote browser
  const fileTypes = filters
    .flatMap((f) => f.extensions)
    .filter((ext) => ext !== "*");

  const handleBrowseClick = async () => {
    if (disabled) return;

    // Use platform file dialogs if available
    if (mode === "save" && platform.capabilities.nativeDialogs) {
      // Save dialog for output files (can create new files)
      try {
        const options: { filters: FileFilter[]; defaultPath?: string } = {
          filters: filters,
        };
        if (value) {
          options.defaultPath = value;
        }
        const filePath = await platform.files.showSaveDialog(options);
        if (filePath) {
          commit(filePath);
        }
      } catch (error) {
        console.error("Error opening save dialog:", error);
      }
    } else if (mode === "open" && platform.capabilities.nativeDialogs) {
      // Open dialog for input files (must exist)
      try {
        const filePath = await platform.files.showOpenDialog({
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
        {/* Remote browse button for hub/external modes */}
        {isRemoteModeAvailable && mode === "open" && (
          <button
            onClick={handleRemoteBrowseClick}
            disabled={disabled}
            title="Browse files on remote server"
            className="px-3 py-2 text-sm transition-colors border rounded-md bg-theme-surface-panel border-theme-border-primary text-theme-text-primary hover:bg-theme-surface-elevated focus:outline-none focus:ring-1 focus:ring-theme-border-focus disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Remote</span>
          </button>
        )}
      </div>

      {/* Browser limitation warning */}
      {showBrowserWarning && <BrowserFileWarning className="mt-2" />}

      {/* Remote file browser dialog */}
      {remoteBrowserOpen && (
        <RemoteFileBrowser
          open={remoteBrowserOpen}
          getToken={getRemoteBrowseToken}
          onSelect={handleRemoteSelect}
          onClose={() => setRemoteBrowserOpen(false)}
          {...(fileTypes.length > 0 ? { fileTypes } : {})}
          title="Select File from Server"
          description="Choose a file from the remote server's file system"
        />
      )}
    </ConfigField>
  );
};
