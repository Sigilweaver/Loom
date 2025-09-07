// CSV data source configuration matching pandas.read_csv parameters exactly

export interface CSVOptions {
  // Basic parameters (top 5 most commonly used)
  filepath_or_buffer?: string; // File path
  sep?: string; // Delimiter
  header?: string | number | null; // Header row
  usecols?: string[] | number[]; // Column selection
  skiprows?: number | number[]; // Rows to skip
  
  // Advanced parameters - Parsing & Structure
  delimiter?: string; // Alias for sep
  names?: string[]; // Column names
  index_col?: string | number | string[] | number[] | false; // Index column(s)
  dtype?: string | Record<string, string>; // Data types
  engine?: 'c' | 'python' | 'pyarrow'; // Parser engine
  
  // Advanced parameters - Data Handling
  converters?: Record<string, string>; // Value converters
  true_values?: string[]; // Values to interpret as True
  false_values?: string[]; // Values to interpret as False
  skipinitialspace?: boolean; // Skip spaces after delimiter
  skipfooter?: number; // Lines to skip at end
  nrows?: number; // Maximum rows to read
  
  // Advanced parameters - Missing Values
  na_values?: string[]; // Additional NA values
  keep_default_na?: boolean; // Keep default NA values
  na_filter?: boolean; // Detect missing values
  
  // Advanced parameters - Date/Time
  parse_dates?: boolean | string[] | number[] | Record<string, string[]>; // Parse dates
  date_format?: string; // Date format
  dayfirst?: boolean; // Day-first date format
  cache_dates?: boolean; // Cache parsed dates
  keep_date_col?: boolean; // Keep original date columns
  
  // Advanced parameters - Text Processing
  encoding?: string; // File encoding
  encoding_errors?: 'strict' | 'ignore' | 'replace'; // Encoding error handling
  lineterminator?: string; // Line ending character
  quotechar?: string; // Quote character
  quoting?: number; // Quoting behavior (0=minimal, 1=all, 2=nonnumeric, 3=none)
  doublequote?: boolean; // Handle double quotes
  escapechar?: string; // Escape character
  comment?: string; // Comment character
  dialect?: string; // CSV dialect
  
  // Advanced parameters - Performance & Memory
  iterator?: boolean; // Return iterator
  chunksize?: number; // Chunk size for iteration
  low_memory?: boolean; // Use low memory mode
  memory_map?: boolean; // Use memory mapping
  compression?: string | Record<string, unknown>; // Compression type
  
  // Advanced parameters - Error Handling
  on_bad_lines?: 'error' | 'warn' | 'skip'; // Bad line handling
  skip_blank_lines?: boolean; // Skip blank lines
  
  // Advanced parameters - Numeric & Formatting
  thousands?: string; // Thousands separator
  decimal?: string; // Decimal point character
  float_precision?: 'high' | 'legacy' | 'round_trip'; // Float precision
  
  // Advanced parameters - Storage & Backend
  storage_options?: Record<string, unknown>; // Storage connection options
  dtype_backend?: 'numpy_nullable' | 'pyarrow'; // Data type backend
}

export interface CSVConfig {
  category: 'file';
  type: 'csv';
  filePath?: string;
  options?: CSVOptions;
}

// Pandas defaults - only store non-default values in XML
export const PANDAS_CSV_DEFAULTS: Record<string, unknown> = {
  // Basic parameters
  filepath_or_buffer: undefined,
  sep: ',',
  header: 'infer',
  usecols: undefined,
  skiprows: undefined,
  
  // Advanced parameters - Parsing & Structure
  delimiter: undefined, // alias for sep
  names: undefined,
  index_col: undefined,
  dtype: undefined,
  engine: undefined, // pandas auto-selects
  
  // Advanced parameters - Data Handling
  converters: undefined,
  true_values: undefined,
  false_values: undefined,
  skipinitialspace: false,
  skipfooter: 0,
  nrows: undefined,
  
  // Advanced parameters - Missing Values
  na_values: undefined,
  keep_default_na: true,
  na_filter: true,
  
  // Advanced parameters - Date/Time
  parse_dates: false,
  date_format: undefined,
  dayfirst: false,
  cache_dates: true,
  keep_date_col: false,
  
  // Advanced parameters - Text Processing
  encoding: 'utf-8', // pandas default
  encoding_errors: 'strict',
  lineterminator: undefined,
  quotechar: '"',
  quoting: 0, // csv.QUOTE_MINIMAL
  doublequote: true,
  escapechar: undefined,
  comment: undefined,
  dialect: undefined,
  
  // Advanced parameters - Performance & Memory
  iterator: false,
  chunksize: undefined,
  low_memory: true,
  memory_map: false,
  compression: 'infer',
  
  // Advanced parameters - Error Handling
  on_bad_lines: 'error',
  skip_blank_lines: true,
  
  // Advanced parameters - Numeric & Formatting
  thousands: undefined,
  decimal: '.',
  float_precision: undefined,
  
  // Advanced parameters - Storage & Backend
  storage_options: undefined,
  dtype_backend: 'numpy_nullable',
};

// Get default CSV configuration
export function getDefaultCSVConfig(): CSVConfig {
  return {
    category: 'file',
    type: 'csv',
    options: {
      // Only include essential options, let pandas handle the rest as defaults
    }
  };
}

// Check if a value differs from pandas default
export function isDifferentFromDefault(key: keyof CSVOptions, value: unknown): boolean {
  const defaultValue = PANDAS_CSV_DEFAULTS[key as keyof typeof PANDAS_CSV_DEFAULTS];
  
  // Handle arrays
  if (Array.isArray(value) && Array.isArray(defaultValue)) {
    return JSON.stringify(value) !== JSON.stringify(defaultValue);
  }
  
  // Handle undefined/null
  if (value === undefined || value === null) {
    return false; // Don't serialize undefined/null values
  }
  
  return value !== defaultValue;
}

// Basic vs Advanced parameter classification
export const BASIC_CSV_PARAMS: (keyof CSVOptions)[] = [
  'filepath_or_buffer',
  'sep',
  'header', 
  'usecols',
  'skiprows'
];

export const ADVANCED_CSV_PARAMS: Record<string, (keyof CSVOptions)[]> = {
  'Parsing & Structure': [
    'delimiter',
    'names',
    'index_col',
    'dtype',
    'engine'
  ],
  'Data Handling': [
    'converters',
    'true_values',
    'false_values', 
    'skipinitialspace',
    'skipfooter',
    'nrows'
  ],
  'Missing Values': [
    'na_values',
    'keep_default_na',
    'na_filter'
  ],
  'Date/Time': [
    'parse_dates',
    'date_format',
    'dayfirst',
    'cache_dates',
    'keep_date_col'
  ],
  'Text Processing': [
    'encoding',
    'encoding_errors',
    'lineterminator',
    'quotechar',
    'quoting',
    'doublequote',
    'escapechar',
    'comment',
    'dialect'
  ],
  'Performance & Memory': [
    'iterator',
    'chunksize',
    'low_memory',
    'memory_map',
    'compression'
  ],
  'Error Handling': [
    'on_bad_lines',
    'skip_blank_lines'
  ],
  'Numeric & Formatting': [
    'thousands',
    'decimal',
    'float_precision'
  ],
  'Storage & Backend': [
    'storage_options',
    'dtype_backend'
  ]
};

// Common delimiter presets
export const DELIMITER_PRESETS = [
  { label: 'Comma (,)', value: ',' },
  { label: 'Tab (\\t)', value: '\t' },
  { label: 'Semicolon (;)', value: ';' },
  { label: 'Pipe (|)', value: '|' },
  { label: 'Space', value: ' ' },
  { label: 'Custom', value: 'custom' }
] as const;

// Common encoding options
export const ENCODING_OPTIONS = [
  { label: 'Auto-detect', value: '' },
  { label: 'UTF-8', value: 'utf-8' },
  { label: 'UTF-16', value: 'utf-16' },
  { label: 'Latin-1 (ISO-8859-1)', value: 'latin1' },
  { label: 'ASCII', value: 'ascii' },
  { label: 'Windows-1252', value: 'cp1252' }
] as const;

// Header options
export const HEADER_OPTIONS = [
  { label: 'Auto-detect (infer)', value: 'infer' },
  { label: 'No headers', value: 'none' },
  { label: 'First row (0)', value: '0' },
  { label: 'Second row (1)', value: '1' },
  { label: 'Custom row', value: 'custom' }
] as const;

// Engine options
export const ENGINE_OPTIONS = [
  { label: 'Auto (pandas default)', value: '' },
  { label: 'C engine (fastest)', value: 'c' },
  { label: 'Python engine (most features)', value: 'python' },
  { label: 'PyArrow engine (experimental)', value: 'pyarrow' }
] as const;

// Quoting options (corresponds to csv.QUOTE_* constants)
export const QUOTING_OPTIONS = [
  { label: 'Minimal (default)', value: 0 },
  { label: 'All fields', value: 1 },
  { label: 'Non-numeric fields', value: 2 },
  { label: 'None', value: 3 }
] as const;

// Error handling options
export const ON_BAD_LINES_OPTIONS = [
  { label: 'Error (stop on bad lines)', value: 'error' },
  { label: 'Warn (show warning, continue)', value: 'warn' },
  { label: 'Skip (silently skip bad lines)', value: 'skip' }
] as const;

// Encoding error handling options
export const ENCODING_ERRORS_OPTIONS = [
  { label: 'Strict (raise error)', value: 'strict' },
  { label: 'Ignore (skip invalid characters)', value: 'ignore' },
  { label: 'Replace (replace with placeholder)', value: 'replace' }
] as const;

// Float precision options
export const FLOAT_PRECISION_OPTIONS = [
  { label: 'Default (high precision)', value: '' },
  { label: 'High precision', value: 'high' },
  { label: 'Legacy (original pandas)', value: 'legacy' },
  { label: 'Round-trip (exact)', value: 'round_trip' }
] as const;

// Data type backend options
export const DTYPE_BACKEND_OPTIONS = [
  { label: 'NumPy nullable (default)', value: 'numpy_nullable' },
  { label: 'PyArrow (experimental)', value: 'pyarrow' }
] as const;

// Compression options
export const COMPRESSION_OPTIONS = [
  { label: 'Auto-detect (infer)', value: 'infer' },
  { label: 'None', value: '' },
  { label: 'Gzip (.gz)', value: 'gzip' },
  { label: 'Bzip2 (.bz2)', value: 'bz2' },
  { label: 'Zip (.zip)', value: 'zip' },
  { label: 'XZ (.xz)', value: 'xz' },
  { label: 'Zstandard (.zst)', value: 'zstd' },
  { label: 'Tar (.tar)', value: 'tar' }
] as const;
