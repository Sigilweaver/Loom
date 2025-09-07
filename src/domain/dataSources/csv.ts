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
  compression?: string | Record<string, any>;
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
  storage_options?: Record<string, any>;
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
export const PANDAS_CSV_DEFAULTS: Required<Omit<CSVOptions, 'converters' | 'date_parser' | 'storage_options'>> = {
  sep: ',',
  delimiter: undefined as any, // alias for sep
  header: 'infer',
  names: undefined as any,
  index_col: undefined as any,
  usecols: undefined as any,
  dtype: undefined as any,
  engine: undefined as any, // pandas auto-selects
  true_values: undefined as any,
  false_values: undefined as any,
  skipinitialspace: false,
  skiprows: undefined as any,
  skipfooter: 0,
  nrows: undefined as any,
  na_values: undefined as any,
  keep_default_na: true,
  na_filter: true,
  verbose: false,
  skip_blank_lines: true,
  parse_dates: false,
  infer_datetime_format: false,
  keep_date_col: false,
  date_format: undefined as any,
  dayfirst: false,
  cache_dates: true,
  iterator: false,
  chunksize: undefined as any,
  compression: 'infer',
  thousands: undefined as any,
  decimal: '.',
  lineterminator: undefined as any,
  quotechar: '"',
  quoting: 0, // csv.QUOTE_MINIMAL
  doublequote: true,
  escapechar: undefined as any,
  comment: undefined as any,
  encoding: undefined as any, // pandas auto-detects by default
  encoding_errors: 'strict',
  dialect: undefined as any,
  on_bad_lines: 'error',
  delim_whitespace: false,
  low_memory: true,
  memory_map: false,
  float_precision: undefined as any,
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
export function isDifferentFromDefault(key: keyof CSVOptions, value: any): boolean {
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
