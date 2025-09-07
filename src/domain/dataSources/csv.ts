// CSV data source configuration matching pandas.read_csv parameters exactly

export interface CSVOptions {
  // Core parameters (always visible)
  sep?: string;
  header?: string | number;
  names?: string[];
  usecols?: string[];
  skiprows?: number;
  nrows?: number;
  encoding?: string;
  na_values?: string[];
  keep_default_na?: boolean;
  skip_blank_lines?: boolean;
  
  // Advanced parameters (collapsible)
  delimiter?: string; // alias for sep
  index_col?: string | number | string[] | false;
  dtype?: string | Record<string, string>;
  engine?: 'c' | 'python' | 'pyarrow';
  converters?: Record<string, string>; // Not implemented in UI
  true_values?: string[];
  false_values?: string[];
  skipinitialspace?: boolean;
  skipfooter?: number;
  na_filter?: boolean;
  verbose?: boolean;
  parse_dates?: boolean | string[] | Record<string, string[]>;
  infer_datetime_format?: boolean;
  keep_date_col?: boolean;
  date_parser?: string; // Not implemented in UI
  date_format?: string;
  dayfirst?: boolean;
  cache_dates?: boolean;
  iterator?: boolean;
  chunksize?: number;
  compression?: string | Record<string, unknown>;
  thousands?: string;
  decimal?: string;
  lineterminator?: string;
  quotechar?: string;
  quoting?: number;
  doublequote?: boolean;
  escapechar?: string;
  comment?: string;
  dialect?: string;
  on_bad_lines?: 'error' | 'warn' | 'skip';
  delim_whitespace?: boolean;
  low_memory?: boolean;
  memory_map?: boolean;
  float_precision?: 'high' | 'legacy' | 'round_trip';
  storage_options?: Record<string, unknown>;
  dtype_backend?: 'numpy_nullable' | 'pyarrow';
  encoding_errors?: 'strict' | 'ignore' | 'replace';
}

export interface CSVConfig {
  category: 'file';
  type: 'csv';
  filePath?: string;
  options?: CSVOptions;
}

// Pandas defaults - only store non-default values in XML
export const PANDAS_CSV_DEFAULTS: Record<string, unknown> = {
  sep: ',',
  delimiter: undefined, // alias for sep
  header: 'infer',
  names: undefined,
  index_col: undefined,
  usecols: undefined,
  dtype: undefined,
  engine: undefined, // pandas auto-selects
  true_values: undefined,
  false_values: undefined,
  skipinitialspace: false,
  skiprows: undefined,
  skipfooter: 0,
  nrows: undefined,
  na_values: undefined,
  keep_default_na: true,
  na_filter: true,
  verbose: false,
  skip_blank_lines: true,
  parse_dates: false,
  infer_datetime_format: false,
  keep_date_col: false,
  date_format: undefined,
  dayfirst: false,
  cache_dates: true,
  iterator: false,
  chunksize: undefined,
  compression: 'infer',
  thousands: undefined,
  decimal: '.',
  lineterminator: undefined,
  quotechar: '"',
  quoting: 0, // csv.QUOTE_MINIMAL
  doublequote: true,
  escapechar: undefined,
  comment: undefined,
  encoding: undefined, // pandas auto-detects by default
  encoding_errors: 'strict',
  dialect: undefined,
  on_bad_lines: 'error',
  delim_whitespace: false,
  low_memory: true,
  memory_map: false,
  float_precision: undefined,
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

// Standard vs Advanced parameter classification
export const STANDARD_CSV_PARAMS: (keyof CSVOptions)[] = [
  'sep',
  'header', 
  'names',
  'usecols',
  'skiprows',
  'nrows',
  'encoding',
  'na_values',
  'keep_default_na',
  'skip_blank_lines'
];

export const ADVANCED_CSV_PARAMS: (keyof CSVOptions)[] = [
  'delimiter',
  'index_col',
  'dtype',
  'engine',
  'true_values',
  'false_values', 
  'skipinitialspace',
  'skipfooter',
  'na_filter',
  'verbose',
  'parse_dates',
  'infer_datetime_format',
  'keep_date_col',
  'date_format',
  'dayfirst',
  'cache_dates',
  'iterator',
  'chunksize',
  'compression',
  'thousands',
  'decimal',
  'lineterminator',
  'quotechar',
  'quoting',
  'doublequote',
  'escapechar',
  'comment',
  'dialect',
  'on_bad_lines',
  'delim_whitespace',
  'low_memory',
  'memory_map',
  'float_precision',
  'storage_options',
  'dtype_backend',
  'encoding_errors'
];

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
  'utf-8',
  'utf-16',
  'latin1',
  'ascii',
  'cp1252'
] as const;

// Header options
export const HEADER_OPTIONS = [
  { label: 'Auto-detect (infer)', value: 'infer' },
  { label: 'No headers', value: 'none' },
  { label: 'First row (0)', value: '0' },
  { label: 'Second row (1)', value: '1' },
  { label: 'Custom row', value: 'custom' }
] as const;
