// Configuration types for tool parameters

export interface FieldSchema {
  id: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'file';
  defaultValue: any;
  required?: boolean;
  dependsOn?: string; // Show field only if another field has specific value
  options?: { value: string; label: string }[];
  validation?: (value: any, allValues: Record<string, any>) => string | null;
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
  parameters: Record<string, any>;
  isValid: boolean;
  errors: string[];
}
