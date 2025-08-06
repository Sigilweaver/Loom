// Configuration types for tool parameters

export type FieldValue = string | number | boolean | string[] | null | Record<string, unknown>[];

export interface FieldSchema {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'file' | 'password' | 'textarea';
  defaultValue: FieldValue;
  required?: boolean;
  dependsOn?: string; // Show field only if another field has specific value
  options?: { value: string; label: string }[];
  validation?: (value: FieldValue, allValues: Record<string, FieldValue>) => string | null;
  helpText?: string;
}

export interface ConnectionType {
  id: string;
  displayName: string;
  category: 'file' | 'database';
  extensions?: string[]; // For file types
  configSchema: FieldSchema[];
  isImplemented: boolean;
}

export interface ToolConfiguration {
  toolId: string;
  toolType: string;
  connectionType?: string;
  parameters: Record<string, FieldValue>;
  isValid: boolean;
  errors: string[];
}
