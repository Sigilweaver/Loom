import React from 'react';
import { ConfigFile, BrowserFileWarning } from './primitives';

interface ConfigTestingPanelProps {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}

export const ConfigTestingPanel: React.FC<ConfigTestingPanelProps> = ({ config, onChange }) => {
  
  const updateConfig = (key: string, value: unknown) => {
    onChange({
      ...config,
      [key]: value
    });
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-6 text-theme-text-primary">
        {/* Testing Tool Header */}
        <div className="flex items-center justify-between bg-theme-surface-elevated p-3 rounded-md border border-theme-border-primary">
          <div className="flex items-center space-x-3">
            <div className="text-xl">🧪</div>
            <div>
              <h3 className="font-medium text-theme-text-primary">Config Primitives Testing</h3>
              <p className="text-xs text-theme-text-tertiary">Component playground for configuration primitives</p>
            </div>
          </div>
          <div className="px-2 py-1 text-xs bg-theme-interactive-accent text-black rounded">
            DEV ONLY
          </div>
        </div>

        {/* Placeholder for primitives */}
        <div className="space-y-6">
          <h3 className="text-sm font-semibold text-theme-text-primary border-b border-theme-border-primary pb-1">
            Configuration Primitives
          </h3>
          
          {/* ConfigFile Primitive Test */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              ConfigFile - File Path Selection
            </h4>
            
            {/* CSV Filter Example */}
            <ConfigFile
              value={(config.testCSVFile as string) || ''}
              onChange={(value) => updateConfig('testCSVFile', value)}
              label="CSV File"
              placeholder="Select a CSV file..."
              filters={[
                { name: 'CSV Files', extensions: ['csv', 'tsv', 'tab'] },
                { name: 'All Files', extensions: ['*'] }
              ]}
              accept=".csv,.tsv,.tab"
            />
            
            {/* Excel Filter Example */}
            <ConfigFile
              value={(config.testExcelFile as string) || ''}
              onChange={(value) => updateConfig('testExcelFile', value)}
              label="Excel File"
              placeholder="Select an Excel file..."
              filters={[
                { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
                { name: 'All Files', extensions: ['*'] }
              ]}
              accept=".xlsx,.xls"
            />
            
            {/* Data Files Filter Example */}
            <ConfigFile
              value={(config.testDataFile as string) || ''}
              onChange={(value) => updateConfig('testDataFile', value)}
              label="Data File (Multiple Types)"
              placeholder="Select any data file..."
              filters={[
                { name: 'Data Files', extensions: ['csv', 'xlsx', 'parquet', 'json', 'tsv'] },
                { name: 'CSV Files', extensions: ['csv', 'tsv'] },
                { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
                { name: 'Parquet Files', extensions: ['parquet'] },
                { name: 'JSON Files', extensions: ['json'] },
                { name: 'All Files', extensions: ['*'] }
              ]}
              accept=".csv,.xlsx,.parquet,.json,.tsv"
            />
            
            {/* Custom Filter Example */}
            <ConfigFile
              value={(config.testCustomFile as string) || ''}
              onChange={(value) => updateConfig('testCustomFile', value)}
              label="Custom Filters (Text & Log Files)"
              placeholder="Select text or log files..."
              filters={[
                { name: 'Text Files', extensions: ['txt', 'log'] },
                { name: 'Configuration Files', extensions: ['json', 'yaml', 'yml', 'toml'] },
                { name: 'All Files', extensions: ['*'] }
              ]}
              accept=".txt,.log,.json,.yaml,.yml,.toml"
            />
            
            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-2">Current Values:</div>
              <div>CSV: <code className="bg-theme-surface-panel px-1 rounded">
                {(config.testCSVFile as string) || 'none'}
              </code></div>
              <div>Excel: <code className="bg-theme-surface-panel px-1 rounded">
                {(config.testExcelFile as string) || 'none'}
              </code></div>
              <div>Data: <code className="bg-theme-surface-panel px-1 rounded">
                {(config.testDataFile as string) || 'none'}
              </code></div>
              <div>Custom: <code className="bg-theme-surface-panel px-1 rounded">
                {(config.testCustomFile as string) || 'none'}
              </code></div>
            </div>
          </div>

          {/* Placeholder for other primitives */}
          <div className="space-y-4 border-t border-theme-border-primary pt-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Reusable UI Components
            </h4>
            
            {/* Browser Warning Demo */}
            <div className="space-y-2">
              <div className="text-sm font-medium text-theme-text-primary">
                Browser File Warning (Standalone)
              </div>
              <div className="text-xs text-theme-text-tertiary mb-2">
                This warning appears automatically when running in browser mode:
              </div>
              <BrowserFileWarning />
            </div>
            
            {/* Note about ConfigFile integration */}
            <div className="text-xs text-theme-text-tertiary bg-theme-surface-elevated p-3 rounded">
              <div className="font-medium mb-1">Note:</div>
              <p>The ConfigFile primitive above automatically includes this warning when showBrowserWarning=true (default).</p>
              <p className="mt-1">You can also use BrowserFileWarning standalone in other file-related components.</p>
            </div>
          </div>

          {/* Coming soon */}
          <div className="text-center py-8 text-theme-text-tertiary border-t border-theme-border-primary">
            <div className="text-2xl mb-2">🏗️</div>
            <p className="text-sm font-medium">More Primitives Coming Soon</p>
            <p className="text-xs mt-1">ConfigBoolean, ConfigText, ConfigNumber, ConfigSelect</p>
          </div>
        </div>
      </div>
    </div>
  );
};