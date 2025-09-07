import { useState } from 'react';
import { CSVOptions, CSVConfig, DELIMITER_PRESETS, HEADER_OPTIONS, isDifferentFromDefault } from '../domain/dataSources/csv';

interface CSVConfigPanelProps {
  config: CSVConfig;
  onChange: (config: CSVConfig) => void;
  onChangeDataSource?: () => void;
}

export const CSVConfigPanel: React.FC<CSVConfigPanelProps> = ({ config, onChange, onChangeDataSource }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customDelimiter, setCustomDelimiter] = useState('');
  const [customHeaderRow, setCustomHeaderRow] = useState('');

  const options = config.options || {};

  const updateOption = (key: keyof CSVOptions, value: any) => {
    const newOptions = { ...options };
    
    // Remove if reverting to default, otherwise set value
    if (value === undefined || value === null || value === '' || 
        (Array.isArray(value) && value.length === 0) ||
        !isDifferentFromDefault(key, value)) {
      delete newOptions[key];
    } else {
      (newOptions as any)[key] = value;
    }

    onChange({
      ...config,
      options: newOptions
    });
  };

  const updateFilePath = (value: string) => {
    const newConfig = { ...config };
    if (value) {
      newConfig.filePath = value;
    } else {
      delete newConfig.filePath;
    }
    onChange(newConfig);
  };

  // Handle delimiter selection
  const handleDelimiterChange = (preset: string) => {
    if (preset === 'custom') {
      setCustomDelimiter(options.sep || '');
    } else {
      updateOption('sep', preset);
      setCustomDelimiter('');
    }
  };

  // Handle header selection
  const handleHeaderChange = (preset: string) => {
    if (preset === 'custom') {
      setCustomHeaderRow('');
    } else if (preset === 'none') {
      updateOption('header', null);
      setCustomHeaderRow('');
    } else if (preset === 'infer') {
      updateOption('header', 'infer');
      setCustomHeaderRow('');
    } else {
      updateOption('header', parseInt(preset));
      setCustomHeaderRow('');
    }
  };

  const getCurrentDelimiterPreset = () => {
    const currentSep = options.sep || ','; // Default to comma if not set
    const preset = DELIMITER_PRESETS.find(p => p.value === currentSep);
    return preset ? preset.value : 'custom';
  };

  const getCurrentHeaderPreset = () => {
    const currentHeader = options.header;
    if (currentHeader === 'infer' || currentHeader === undefined) return 'infer';
    if (currentHeader === null) return 'none';
    if (typeof currentHeader === 'number') {
      const preset = HEADER_OPTIONS.find(h => h.value === String(currentHeader));
      return preset ? preset.value : 'custom';
    }
    return 'custom';
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="p-4 space-y-6 text-theme-text-primary">
        {/* Data Source Type Header */}
        <div className="flex items-center justify-between bg-theme-surface-elevated p-3 rounded-md border border-theme-border-primary">
          <div className="flex items-center space-x-3">
            <div className="text-xl">📄</div>
            <div>
              <h3 className="font-medium text-theme-text-primary">CSV Data Source</h3>
              <p className="text-xs text-theme-text-tertiary">Comma-separated values file</p>
            </div>
          </div>
          {onChangeDataSource && (
            <button
              onClick={onChangeDataSource}
              className="px-3 py-1 text-xs bg-theme-surface-panel border border-theme-border-primary rounded
                         text-theme-text-secondary hover:text-theme-text-primary hover:bg-theme-surface-elevated
                         transition-colors"
            >
              Change Type
            </button>
          )}
        </div>

        {/* File Path */}
        <div>
          <label className="block text-sm font-medium text-theme-text-secondary mb-2">
            File Path
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={config.filePath || ''}
              onChange={(e) => updateFilePath(e.target.value)}
              placeholder="Enter file path or click Browse..."
              className="flex-1 px-3 py-2 border border-theme-border-primary rounded-md text-sm 
                         bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                         focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
            />
            <button
              onClick={async () => {
                console.log('Browse button clicked');
                console.log('window.electronAPI available:', !!window.electronAPI);
                console.log('showOpenDialog available:', !!window.electronAPI?.showOpenDialog);
                
                // Use Electron's file dialog if available, otherwise fallback
                if (window.electronAPI?.showOpenDialog) {
                  try {
                    console.log('Calling Electron showOpenDialog...');
                    const filePath = await window.electronAPI.showOpenDialog({
                      filters: [
                        { name: 'CSV Files', extensions: ['csv'] },
                        { name: 'Text Files', extensions: ['txt'] },
                        { name: 'All Files', extensions: ['*'] }
                      ]
                    });
                    console.log('Electron dialog returned:', filePath);
                    if (filePath) {
                      console.log('Setting file path to:', filePath);
                      updateFilePath(filePath);
                    }
                  } catch (error) {
                    console.error('Error opening file dialog:', error);
                  }
                } else {
                  console.log('Using fallback browser file input');
                  // Fallback for web browser
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.csv,.txt';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      // In browser, we can only get the file name
                      console.log('Browser fallback - file name:', file.name);
                      updateFilePath(file.name);
                    }
                  };
                  input.click();
                }
              }}
              className="px-4 py-2 bg-theme-surface-panel border border-theme-border-primary rounded-md text-sm
                         text-theme-text-primary hover:bg-theme-surface-elevated transition-colors
                         focus:outline-none focus:ring-1 focus:ring-theme-border-focus"
            >
              Browse
            </button>
          </div>
        </div>

        {/* Standard Options */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-theme-text-primary border-b border-theme-border-primary pb-1">
            Basic Options
          </h3>

          {/* Delimiter */}
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
              Delimiter
            </label>
            <div className="space-y-2">
              <select
                value={getCurrentDelimiterPreset()}
                onChange={(e) => handleDelimiterChange(e.target.value)}
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              >
                {DELIMITER_PRESETS.map(preset => (
                  <option key={preset.value} value={preset.value}>
                    {preset.label}
                  </option>
                ))}
              </select>
              
              {getCurrentDelimiterPreset() === 'custom' && (
                <input
                  type="text"
                  value={customDelimiter}
                  onChange={(e) => {
                    setCustomDelimiter(e.target.value);
                    updateOption('sep', e.target.value);
                  }}
                  placeholder="Enter custom delimiter"
                  maxLength={5}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              )}
            </div>
          </div>

          {/* Headers */}
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
              Headers
            </label>
            <div className="space-y-2">
              <select
                value={getCurrentHeaderPreset()}
                onChange={(e) => handleHeaderChange(e.target.value)}
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
            >
              {HEADER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            
            {getCurrentHeaderPreset() === 'custom' && (
              <input
                type="number"
                value={customHeaderRow}
                onChange={(e) => {
                  setCustomHeaderRow(e.target.value);
                  const row = parseInt(e.target.value);
                  if (!isNaN(row) && row >= 0) {
                    updateOption('header', row);
                  }
                }}
                placeholder="Row number (0-based)"
                min="0"
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              />
            )}
          </div>
        </div>

        {/* Column Selection */}
        <div>
          <label className="block text-sm font-medium text-theme-text-secondary mb-2">
            Columns to Use (optional)
          </label>
          <input
            type="text"
            value={options.usecols?.join(',') || ''}
            onChange={(e) => {
              const value = e.target.value.trim();
              if (value) {
                const cols = value.split(',').map(c => c.trim()).filter(c => c);
                updateOption('usecols', cols.length > 0 ? cols : undefined);
              } else {
                updateOption('usecols', undefined);
              }
            }}
            placeholder="e.g., name,age,salary or 0,1,2"
            className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                       bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                       focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
          />
          <p className="text-xs text-theme-text-tertiary mt-1">
            Comma-separated column names or indices
          </p>
        </div>

        {/* Row Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
              Skip Rows
            </label>
            <input
              type="number"
              value={options.skiprows ?? ''}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                updateOption('skiprows', isNaN(value) || value === 0 ? undefined : value);
              }}
              placeholder="Number of rows to skip (default: 0)"
              min="0"
              className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                         bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                         focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
              Max Rows
            </label>
            <input
              type="number"
              value={options.nrows ?? ''}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                updateOption('nrows', isNaN(value) ? undefined : value);
              }}
              placeholder="All rows (no limit)"
              min="1"
              className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                         bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                         focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
            />
          </div>
        </div>

        {/* Missing Values */}
        <div>
          <label className="block text-sm font-medium text-theme-text-secondary mb-2">
            Additional Missing Values (optional)
          </label>
          <input
            type="text"
            value={options.na_values?.join(',') || ''}
            onChange={(e) => {
              const value = e.target.value.trim();
              if (value) {
                const values = value.split(',').map(v => v.trim()).filter(v => v);
                updateOption('na_values', values.length > 0 ? values : undefined);
              } else {
                updateOption('na_values', undefined);
              }
            }}
            placeholder="e.g., NULL,N/A,missing"
            className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                       bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                       focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
          />
          <p className="text-xs text-theme-text-tertiary mt-1">
            Comma-separated values to treat as NaN (in addition to defaults)
          </p>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center text-sm text-theme-text-secondary hover:text-theme-text-primary transition-colors"
        >
          <span className={`mr-2 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}>
            ▶
          </span>
          Advanced Options
        </button>
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="space-y-4 border-t border-theme-border-primary pt-4">
          <h3 className="text-sm font-semibold text-theme-text-primary">
            Advanced Parameters
          </h3>
          
          {/* Encoding */}
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
              Encoding
            </label>
            <select
              value={options.encoding || ''}
              onChange={(e) => updateOption('encoding', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                         bg-theme-surface-elevated text-theme-text-primary
                         focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
            >
              <option value="">Auto-detect (default)</option>
              <option value="utf-8">UTF-8</option>
              <option value="latin1">Latin-1 (ISO-8859-1)</option>
              <option value="cp1252">Windows-1252</option>
              <option value="ascii">ASCII</option>
              <option value="utf-16">UTF-16</option>
            </select>
            <p className="text-xs text-theme-text-tertiary mt-1">
              Leave as auto-detect unless you have encoding issues
            </p>
          </div>

          {/* Quote Character */}
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
              Quote Character
            </label>
            <input
              type="text"
              value={options.quotechar ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                updateOption('quotechar', value === '"' || !value ? undefined : value);
              }}
              placeholder='" (double quote - default)'
              maxLength={1}
              className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                         bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                         focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
            />
          </div>

          {/* Comment Character */}
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
              Comment Character
            </label>
            <input
              type="text"
              value={options.comment ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                updateOption('comment', value || undefined);
              }}
              placeholder="Character to mark comments (e.g., #)"
              maxLength={1}
              className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                         bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                         focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
            />
          </div>

          {/* Error Handling */}
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
              Error Handling
            </label>
            <select
              value={options.on_bad_lines || ''}
              onChange={(e) => updateOption('on_bad_lines', e.target.value === 'error' || !e.target.value ? undefined : e.target.value as any)}
              className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                         bg-theme-surface-elevated text-theme-text-primary
                         focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
            >
              <option value="">Error (default - stop on bad lines)</option>
              <option value="warn">Warn (show warning but continue)</option>
              <option value="skip">Skip (silently skip bad lines)</option>
            </select>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
