import React from 'react';
import { Folder } from 'lucide-react';
import { BrowserFileWarning } from './BrowserFileWarning';

export interface FileConfigSectionProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  showBrowserWarning?: boolean;
  className?: string;
}

/**
 * Reusable section wrapper for file-based configuration
 * Automatically includes browser warning for file operations
 */
export const FileConfigSection: React.FC<FileConfigSectionProps> = ({
  title,
  description,
  icon = <Folder className="h-5 w-5" />,
  children,
  showBrowserWarning = true,
  className = ""
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Section Header */}
      <div className="flex items-center justify-between bg-theme-surface-elevated p-3 rounded-md border border-theme-border-primary">
        <div className="flex items-center space-x-3">
          <div className="text-xl">{icon}</div>
          <div>
            <h3 className="font-medium text-theme-text-primary">{title}</h3>
            {description && (
              <p className="text-xs text-theme-text-tertiary">{description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Browser Warning */}
      {showBrowserWarning && (
        <BrowserFileWarning />
      )}

      {/* Content */}
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
};