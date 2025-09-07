import { useState } from 'react';
import { 
  CSVOptions, 
  CSVConfig, 
  DELIMITER_PRESETS, 
  HEADER_OPTIONS, 
  ENCODING_OPTIONS,
  ENGINE_OPTIONS,
  QUOTING_OPTIONS,
  ON_BAD_LINES_OPTIONS,
  ENCODING_ERRORS_OPTIONS,
  FLOAT_PRECISION_OPTIONS,
  DTYPE_BACKEND_OPTIONS,
  COMPRESSION_OPTIONS,
  isDifferentFromDefault 
} from '../domain/dataSources/csv';

interface CSVConfigPanelProps {
  config: CSVConfig;
  onChange: (config: CSVConfig) => void;
  onChangeDataSource?: () => void;
}

export const CSVConfigPanel: React.FC<CSVConfigPanelProps> = ({ config, onChange, onChangeDataSource }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const options = config.options || {};
  
  // Check if current separator is a custom one (not in presets)
  const currentSep = options.sep || ',';
  const isCurrentSepInPresets = DELIMITER_PRESETS.some(p => p.value === currentSep && p.value !== 'custom');
  
  const [isCustomDelimiter, setIsCustomDelimiter] = useState(!isCurrentSepInPresets);
  const [customDelimiter, setCustomDelimiter] = useState(isCurrentSepInPresets ? '' : currentSep);
  const [customHeaderRow, setCustomHeaderRow] = useState('');

  const updateOption = (key: keyof CSVOptions, value: unknown) => {
    const newOptions = { ...options };
    
    // Remove if reverting to default, otherwise set value
    if (value === undefined || value === null || value === '' || 
        (Array.isArray(value) && value.length === 0) ||
        !isDifferentFromDefault(key, value)) {
      delete newOptions[key];
    } else {
      (newOptions as Record<string, unknown>)[key] = value;
    }

    onChange({
      ...config,
      options: newOptions
    });
  };

  // Auto-detect delimiter based on file extension
  const getDelimiterFromFilename = (filename: string): string => {
    const ext = filename.toLowerCase().split('.').pop();
    switch (ext) {
      case 'tsv':
      case 'tab':
        return '\t';
      case 'csv':
        return ',';
      case 'txt':
      case 'dat':
        // For generic text files, check if user has already set a delimiter
        return options.sep || ',';
      default:
        return ',';
    }
  };

  const updateFilePath = (value: string) => {
    const newConfig = { ...config };
    if (value) {
      newConfig.filePath = value;
      
      // Auto-detect and set delimiter if user hasn't explicitly set one
      // Only auto-set if current delimiter is default (comma) or not set
      const currentDelimiter = options.sep || ',';
      const isDefaultDelimiter = currentDelimiter === ',';
      
      if (isDefaultDelimiter) {
        const autoDelimiter = getDelimiterFromFilename(value);
        if (autoDelimiter !== currentDelimiter) {
          const newOptions = { ...options };
          newOptions.sep = autoDelimiter;
          newConfig.options = newOptions;
          
          // Update custom delimiter state to match
          if (autoDelimiter === '\t') {
            setIsCustomDelimiter(false);
            setCustomDelimiter('');
          } else if (autoDelimiter === ',') {
            setIsCustomDelimiter(false);
            setCustomDelimiter('');
          } else {
            // For other delimiters, show as custom
            setIsCustomDelimiter(true);
            setCustomDelimiter(autoDelimiter);
          }
        }
      }
    } else {
      delete newConfig.filePath;
    }
    onChange(newConfig);
  };

  // Handle delimiter selection
  const handleDelimiterChange = (preset: string) => {
    if (preset === 'custom') {
      setIsCustomDelimiter(true);
      setCustomDelimiter(options.sep || ','); // Initialize with current separator
    } else {
      setIsCustomDelimiter(false);
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
    // If we're in custom mode, return 'custom'
    if (isCustomDelimiter) {
      return 'custom';
    }
    
    // Otherwise, find the preset that matches current separator
    const currentSep = options.sep || ','; // Default to comma if not set
    const preset = DELIMITER_PRESETS.find(p => p.value === currentSep && p.value !== 'custom');
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
              <p className="text-xs text-theme-text-tertiary">Delimited text files (CSV, TSV, TAB, TXT)</p>
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
                        { name: 'Delimited Text Files', extensions: ['csv', 'tsv', 'tab', 'txt', 'dat'] },
                        { name: 'CSV Files', extensions: ['csv'] },
                        { name: 'TSV Files', extensions: ['tsv', 'tab'] },
                        { name: 'Text Files', extensions: ['txt', 'dat'] },
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
                  input.accept = '.csv,.tsv,.tab,.txt,.dat';
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

        {/* Basic Options - Top 5 Most Used */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-theme-text-primary border-b border-theme-border-primary pb-1">
            Basic Options (Most Commonly Used)
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
                    const newDelimiter = e.target.value;
                    setCustomDelimiter(newDelimiter);
                    updateOption('sep', newDelimiter);
                    
                    // Check if the entered delimiter matches a preset
                    const matchingPreset = DELIMITER_PRESETS.find(p => p.value === newDelimiter && p.value !== 'custom');
                    if (matchingPreset) {
                      // Switch back to preset mode
                      setIsCustomDelimiter(false);
                      setCustomDelimiter('');
                    }
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
            value={
              Array.isArray(options.usecols) ? 
              options.usecols.map(col => typeof col === 'number' ? col.toString() : col).join(',') : 
              ''
            }
            onChange={(e) => {
              const value = e.target.value.trim();
              if (value) {
                const cols = value.split(',').map(c => {
                  const trimmed = c.trim();
                  if (!trimmed) return null;
                  const num = parseInt(trimmed);
                  return isNaN(num) ? trimmed : num;
                }).filter(c => c !== null) as (string | number)[];
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

        {/* Row Controls */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-theme-text-secondary mb-2">
              Skip Rows
            </label>
            <input
              type="text"
              value={Array.isArray(options.skiprows) ? options.skiprows.join(',') : (options.skiprows ?? '')}
              onChange={(e) => {
                const value = e.target.value.trim();
                if (!value) {
                  updateOption('skiprows', undefined);
                } else if (value.includes(',')) {
                  // Multiple row numbers
                  const rows = value.split(',').map(r => parseInt(r.trim())).filter(r => !isNaN(r) && r >= 0);
                  updateOption('skiprows', rows.length > 0 ? rows : undefined);
                } else {
                  // Single row number
                  const row = parseInt(value);
                  updateOption('skiprows', isNaN(row) || row < 0 ? undefined : row);
                }
              }}
              placeholder="Row number or comma-separated list (e.g., 0,1,2)"
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
        <div className="space-y-6 border-t border-theme-border-primary pt-4">
          <h3 className="text-sm font-semibold text-theme-text-primary">
            Advanced Parameters
          </h3>
          
          {/* Parsing & Structure */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Parsing & Structure
            </h4>
            
            {/* Engine */}
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                Parser Engine
              </label>
              <select
                value={options.engine || ''}
                onChange={(e) => updateOption('engine', e.target.value || undefined)}
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              >
                {ENGINE_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-theme-text-tertiary mt-1">
                C engine is fastest, Python is most feature-complete
              </p>
            </div>

            {/* Column Names */}
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                Column Names (optional)
              </label>
              <input
                type="text"
                value={options.names?.join(',') || ''}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (value) {
                    const names = value.split(',').map(n => n.trim()).filter(n => n);
                    updateOption('names', names.length > 0 ? names : undefined);
                  } else {
                    updateOption('names', undefined);
                  }
                }}
                placeholder="e.g., name,age,salary"
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              />
              <p className="text-xs text-theme-text-tertiary mt-1">
                Custom column names to use (overrides header)
              </p>
            </div>

            {/* Index Column */}
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                Index Column (optional)
              </label>
              <input
                type="text"
                value={
                  options.index_col === false ? 'false' :
                  Array.isArray(options.index_col) ? options.index_col.join(',') :
                  options.index_col || ''
                }
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (!value) {
                    updateOption('index_col', undefined);
                  } else if (value === 'false') {
                    updateOption('index_col', false);
                  } else if (value.includes(',')) {
                    // Multiple columns
                    const cols = value.split(',').map(c => {
                      const trimmed = c.trim();
                      const num = parseInt(trimmed);
                      return isNaN(num) ? trimmed : num;
                    }).filter(c => c !== '');
                    updateOption('index_col', cols.length > 0 ? cols : undefined);
                  } else {
                    // Single column
                    const num = parseInt(value);
                    updateOption('index_col', isNaN(num) ? value : num);
                  }
                }}
                placeholder="Column name/index, comma-separated, or 'false'"
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              />
              <p className="text-xs text-theme-text-tertiary mt-1">
                Column(s) to use as row labels, or 'false' to prevent index
              </p>
            </div>

            {/* Data Types */}
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                Data Types (optional)
              </label>
              <input
                type="text"
                value={
                  typeof options.dtype === 'string' ? options.dtype :
                  options.dtype ? Object.entries(options.dtype).map(([k, v]) => `${k}:${v}`).join(',') :
                  ''
                }
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (!value) {
                    updateOption('dtype', undefined);
                  } else if (value.includes(':')) {
                    // Object format: column:type,column:type
                    const pairs = value.split(',').map(pair => {
                      const [col, type] = pair.split(':').map(s => s.trim());
                      return col && type ? [col, type] : null;
                    }).filter(Boolean) as [string, string][];
                    if (pairs.length > 0) {
                      updateOption('dtype', Object.fromEntries(pairs));
                    } else {
                      updateOption('dtype', undefined);
                    }
                  } else {
                    // String format: all columns same type
                    updateOption('dtype', value);
                  }
                }}
                placeholder="str, int64, float64, or col1:str,col2:int64"
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              />
              <p className="text-xs text-theme-text-tertiary mt-1">
                Global type or column-specific: col1:str,col2:int64
              </p>
            </div>
          </div>

          {/* Data Handling */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Data Handling
            </h4>

            {/* True/False Values */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  True Values
                </label>
                <input
                  type="text"
                  value={options.true_values?.join(',') || ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (value) {
                      const values = value.split(',').map(v => v.trim()).filter(v => v);
                      updateOption('true_values', values.length > 0 ? values : undefined);
                    } else {
                      updateOption('true_values', undefined);
                    }
                  }}
                  placeholder="yes,y,1"
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  False Values
                </label>
                <input
                  type="text"
                  value={options.false_values?.join(',') || ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    if (value) {
                      const values = value.split(',').map(v => v.trim()).filter(v => v);
                      updateOption('false_values', values.length > 0 ? values : undefined);
                    } else {
                      updateOption('false_values', undefined);
                    }
                  }}
                  placeholder="no,n,0"
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>
            </div>

            {/* Skip Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Skip Initial Space
                </label>
                <select
                  value={options.skipinitialspace ? 'true' : 'false'}
                  onChange={(e) => updateOption('skipinitialspace', e.target.value === 'true' ? true : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="false">No (default)</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Skip Footer Rows
                </label>
                <input
                  type="number"
                  value={options.skipfooter ?? ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    updateOption('skipfooter', isNaN(value) || value === 0 ? undefined : value);
                  }}
                  placeholder="0 (default)"
                  min="0"
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>
            </div>
          </div>

          {/* Missing Values */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Missing Values
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Keep Default NA Values
                </label>
                <select
                  value={options.keep_default_na === false ? 'false' : 'true'}
                  onChange={(e) => updateOption('keep_default_na', e.target.value === 'false' ? false : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="true">Yes (default)</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  NA Value Detection
                </label>
                <select
                  value={options.na_filter === false ? 'false' : 'true'}
                  onChange={(e) => updateOption('na_filter', e.target.value === 'false' ? false : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="true">Enable (default)</option>
                  <option value="false">Disable</option>
                </select>
              </div>
            </div>
          </div>

          {/* Date/Time */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Date/Time
            </h4>

            {/* Parse Dates */}
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                Parse Dates
              </label>
              <input
                type="text"
                value={
                  typeof options.parse_dates === 'boolean' ? (options.parse_dates ? 'true' : 'false') :
                  Array.isArray(options.parse_dates) ? options.parse_dates.join(',') :
                  options.parse_dates ? Object.entries(options.parse_dates).map(([k, v]) => `${k}:[${Array.isArray(v) ? v.join(',') : v}]`).join(';') :
                  ''
                }
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (!value || value === 'false') {
                    updateOption('parse_dates', undefined);
                  } else if (value === 'true') {
                    updateOption('parse_dates', true);
                  } else if (value.includes(':')) {
                    // Object format: name:[col1,col2];name2:[col3]
                    const pairs = value.split(';').map(pair => {
                      const [name, cols] = pair.split(':');
                      if (name && cols) {
                        const colList = cols.replace(/[\[\]]/g, '').split(',').map(c => c.trim()).filter(c => c);
                        return [name.trim(), colList];
                      }
                      return null;
                    }).filter(Boolean) as [string, string[]][];
                    if (pairs.length > 0) {
                      updateOption('parse_dates', Object.fromEntries(pairs));
                    } else {
                      updateOption('parse_dates', undefined);
                    }
                  } else {
                    // Array format: col1,col2,col3
                    const cols = value.split(',').map(c => c.trim()).filter(c => c);
                    updateOption('parse_dates', cols.length > 0 ? cols : undefined);
                  }
                }}
                placeholder="true, col1,col2, or date:[col1,col2];timestamp:[col3]"
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              />
              <p className="text-xs text-theme-text-tertiary mt-1">
                true (index), columns, or named: date:[col1,col2]
              </p>
            </div>

            {/* Date Format & Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Date Format
                </label>
                <input
                  type="text"
                  value={options.date_format || ''}
                  onChange={(e) => updateOption('date_format', e.target.value || undefined)}
                  placeholder="%Y-%m-%d, %m/%d/%Y, ISO8601, mixed"
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Day First
                </label>
                <select
                  value={options.dayfirst ? 'true' : 'false'}
                  onChange={(e) => updateOption('dayfirst', e.target.value === 'true' ? true : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="false">No (default)</option>
                  <option value="true">Yes (DD/MM format)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Cache Dates
                </label>
                <select
                  value={options.cache_dates === false ? 'false' : 'true'}
                  onChange={(e) => updateOption('cache_dates', e.target.value === 'false' ? false : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="true">Yes (default)</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Keep Date Columns
                </label>
                <select
                  value={options.keep_date_col ? 'true' : 'false'}
                  onChange={(e) => updateOption('keep_date_col', e.target.value === 'true' ? true : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="false">No (default)</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
          </div>

          {/* Text Processing */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Text Processing
            </h4>

            {/* Encoding */}
            <div className="grid grid-cols-2 gap-4">
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
                  {ENCODING_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Encoding Errors
                </label>
                <select
                  value={options.encoding_errors || 'strict'}
                  onChange={(e) => updateOption('encoding_errors', e.target.value === 'strict' ? undefined : e.target.value)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  {ENCODING_ERRORS_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quote & Escape Characters */}
            <div className="grid grid-cols-3 gap-4">
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
                  placeholder='" (default)'
                  maxLength={1}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Escape Character
                </label>
                <input
                  type="text"
                  value={options.escapechar ?? ''}
                  onChange={(e) => updateOption('escapechar', e.target.value || undefined)}
                  placeholder="None (default)"
                  maxLength={1}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Comment Character
                </label>
                <input
                  type="text"
                  value={options.comment ?? ''}
                  onChange={(e) => updateOption('comment', e.target.value || undefined)}
                  placeholder="None (default)"
                  maxLength={1}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>
            </div>

            {/* Quoting & Line Options */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Quoting Behavior
                </label>
                <select
                  value={options.quoting ?? 0}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    updateOption('quoting', value === 0 ? undefined : value);
                  }}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  {QUOTING_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Double Quote
                </label>
                <select
                  value={options.doublequote === false ? 'false' : 'true'}
                  onChange={(e) => updateOption('doublequote', e.target.value === 'false' ? false : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="true">Yes (default)</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Line Terminator
                </label>
                <input
                  type="text"
                  value={options.lineterminator ?? ''}
                  onChange={(e) => updateOption('lineterminator', e.target.value || undefined)}
                  placeholder="Auto (default)"
                  maxLength={2}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>
            </div>

            {/* Dialect */}
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                CSV Dialect (optional)
              </label>
              <input
                type="text"
                value={options.dialect ?? ''}
                onChange={(e) => updateOption('dialect', e.target.value || undefined)}
                placeholder="excel, excel-tab, unix"
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              />
              <p className="text-xs text-theme-text-tertiary mt-1">
                Overrides delimiter, quoting, and other text processing options
              </p>
            </div>
          </div>

          {/* Performance & Memory */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Performance & Memory
            </h4>

            {/* Chunking & Iteration */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Iterator Mode
                </label>
                <select
                  value={options.iterator ? 'true' : 'false'}
                  onChange={(e) => updateOption('iterator', e.target.value === 'true' ? true : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="false">No (default)</option>
                  <option value="true">Yes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Chunk Size
                </label>
                <input
                  type="number"
                  value={options.chunksize ?? ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    updateOption('chunksize', isNaN(value) ? undefined : value);
                  }}
                  placeholder="No chunking (default)"
                  min="1"
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>
            </div>

            {/* Memory Options */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Low Memory Mode
                </label>
                <select
                  value={options.low_memory === false ? 'false' : 'true'}
                  onChange={(e) => updateOption('low_memory', e.target.value === 'false' ? false : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="true">Yes (default)</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Memory Mapping
                </label>
                <select
                  value={options.memory_map ? 'true' : 'false'}
                  onChange={(e) => updateOption('memory_map', e.target.value === 'true' ? true : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="false">No (default)</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>

            {/* Compression */}
            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                Compression
              </label>
              <select
                value={options.compression === 'infer' || !options.compression ? 'infer' : 
                       typeof options.compression === 'string' ? options.compression : 'custom'}
                onChange={(e) => {
                  const value = e.target.value;
                  updateOption('compression', value === 'infer' ? undefined : 
                              value === '' ? undefined : value);
                }}
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              >
                {COMPRESSION_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Error Handling */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Error Handling
            </h4>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Bad Lines Handling
                </label>
                <select
                  value={options.on_bad_lines || 'error'}
                  onChange={(e) => updateOption('on_bad_lines', e.target.value === 'error' ? undefined : e.target.value)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  {ON_BAD_LINES_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Skip Blank Lines
                </label>
                <select
                  value={options.skip_blank_lines === false ? 'false' : 'true'}
                  onChange={(e) => updateOption('skip_blank_lines', e.target.value === 'false' ? false : undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  <option value="true">Yes (default)</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          </div>

          {/* Numeric & Formatting */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Numeric & Formatting
            </h4>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Thousands Separator
                </label>
                <input
                  type="text"
                  value={options.thousands ?? ''}
                  onChange={(e) => updateOption('thousands', e.target.value || undefined)}
                  placeholder="None (default)"
                  maxLength={1}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Decimal Point
                </label>
                <input
                  type="text"
                  value={options.decimal ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateOption('decimal', value === '.' || !value ? undefined : value);
                  }}
                  placeholder=". (default)"
                  maxLength={1}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                  Float Precision
                </label>
                <select
                  value={options.float_precision || ''}
                  onChange={(e) => updateOption('float_precision', e.target.value || undefined)}
                  className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                             bg-theme-surface-elevated text-theme-text-primary
                             focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
                >
                  {FLOAT_PRECISION_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Storage & Backend */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold text-theme-text-secondary uppercase tracking-wide">
              Storage & Backend
            </h4>

            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                Data Type Backend
              </label>
              <select
                value={options.dtype_backend || 'numpy_nullable'}
                onChange={(e) => updateOption('dtype_backend', e.target.value === 'numpy_nullable' ? undefined : e.target.value)}
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              >
                {DTYPE_BACKEND_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-theme-text-tertiary mt-1">
                PyArrow backend is experimental but may offer better performance
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-theme-text-secondary mb-2">
                Storage Options (optional)
              </label>
              <input
                type="text"
                value={
                  options.storage_options ? 
                  Object.entries(options.storage_options).map(([k, v]) => `${k}:${v}`).join(',') : 
                  ''
                }
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (!value) {
                    updateOption('storage_options', undefined);
                  } else {
                    const pairs = value.split(',').map(pair => {
                      const [key, val] = pair.split(':').map(s => s.trim());
                      return key && val ? [key, val] : null;
                    }).filter(Boolean) as [string, string][];
                    if (pairs.length > 0) {
                      updateOption('storage_options', Object.fromEntries(pairs));
                    } else {
                      updateOption('storage_options', undefined);
                    }
                  }
                }}
                placeholder="host:example.com,port:443,username:user"
                className="w-full px-3 py-2 border border-theme-border-primary rounded-md text-sm
                           bg-theme-surface-elevated text-theme-text-primary placeholder-theme-text-tertiary
                           focus:outline-none focus:ring-1 focus:ring-theme-border-focus focus:border-theme-border-focus"
              />
              <p className="text-xs text-theme-text-tertiary mt-1">
                Connection options for remote files (key:value,key:value)
              </p>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
