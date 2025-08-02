import { ConnectionType } from '../types/configuration';

// CSV File Configuration
export const csvConfig: ConnectionType = {
  id: 'csv',
  displayName: 'CSV File',
  category: 'file',
  extensions: ['.csv', '.txt'],
  isImplemented: true,
  configSchema: [
    {
      id: 'filePath',
      label: 'File Path',
      type: 'file',
      defaultValue: '',
      required: true,
      helpText: 'Select or enter the path to your CSV file'
    },
    {
      id: 'delimiter',
      label: 'Delimiter',
      type: 'select',
      defaultValue: ',',
      options: [
        { value: ',', label: 'Comma (,)' },
        { value: ';', label: 'Semicolon (;)' },
        { value: '\t', label: 'Tab' },
        { value: '|', label: 'Pipe (|)' },
        { value: 'custom', label: 'Custom...' }
      ],
      helpText: 'Character that separates values in your CSV file'
    },
    {
      id: 'customDelimiter',
      label: 'Custom Delimiter',
      type: 'text',
      defaultValue: '',
      dependsOn: 'delimiter',
      helpText: 'Enter a custom delimiter character'
    },
    {
      id: 'hasHeaders',
      label: 'Headers in First Row',
      type: 'boolean',
      defaultValue: true,
      helpText: 'Check if the first row contains column names'
    },
    {
      id: 'startLine',
      label: 'Start Data Import on Line',
      type: 'number',
      defaultValue: 1,
      validation: (value) => {
        if (value < 1) return 'Line number must be 1 or greater';
        return null;
      },
      helpText: 'Line number where data starts (1-based)'
    },
    {
      id: 'recordLimit',
      label: 'Record Limit',
      type: 'number',
      defaultValue: null,
      helpText: 'Maximum number of records to import (leave empty for all)'
    },
    {
      id: 'encoding',
      label: 'File Encoding',
      type: 'select',
      defaultValue: 'auto',
      options: [
        { value: 'auto', label: 'Auto-detect (Recommended)' },
        { value: 'utf-8', label: 'UTF-8' },
        { value: 'utf-16', label: 'UTF-16' },
        { value: 'ascii', label: 'ASCII' },
        { value: 'iso-8859-1', label: 'ISO-8859-1 (Latin-1)' }
      ],
      helpText: 'Character encoding of the file - auto-detect is recommended'
    },
    {
      id: 'quoteHandling',
      label: 'Quote Handling',
      type: 'select',
      defaultValue: 'double',
      options: [
        { value: 'double', label: 'Double Quotes (")' },
        { value: 'single', label: 'Single Quotes (\')' },
        { value: 'none', label: 'No Quote Handling' }
      ],
      helpText: 'How to handle quoted values that contain delimiters'
    },
    {
      id: 'continueOnError',
      label: 'Continue Reading on Error',
      type: 'boolean',
      defaultValue: false,
      helpText: 'Skip malformed rows instead of stopping import'
    }
  ]
};

// Excel File Configuration
export const excelConfig: ConnectionType = {
  id: 'excel',
  displayName: 'Excel File',
  category: 'file',
  extensions: ['.xlsx', '.xls'],
  isImplemented: true,
  configSchema: [
    {
      id: 'filePath',
      label: 'File Path',
      type: 'file',
      defaultValue: '',
      required: true,
      helpText: 'Select or enter the path to your Excel file'
    },
    {
      id: 'sheetName',
      label: 'Sheet Name',
      type: 'text',
      defaultValue: '',
      helpText: 'Name of the worksheet to import (leave empty for first sheet)'
    },
    {
      id: 'hasHeaders',
      label: 'Headers in First Row',
      type: 'boolean',
      defaultValue: true,
      helpText: 'Check if the first row contains column names'
    },
    {
      id: 'startRow',
      label: 'Start Row',
      type: 'number',
      defaultValue: 1,
      validation: (value) => {
        if (value < 1) return 'Row number must be 1 or greater';
        return null;
      },
      helpText: 'Row number where data starts (1-based)'
    },
    {
      id: 'recordLimit',
      label: 'Record Limit',
      type: 'number',
      defaultValue: null,
      helpText: 'Maximum number of records to import (leave empty for all)'
    }
  ]
};
