import { useState, useEffect } from 'react';
import { Tool } from '../types/workflow';
import { ToolConfiguration, ConnectionType } from '../types/configuration';
import { getInputConnectionTypes, getConnectionType } from '../config/connectionTypes';
import ConfigurationHeader from './ConfigurationHeader';
import ConnectionTypeSelector from './ConnectionTypeSelector';
import FieldRenderer from './FieldRenderer';
import WorkflowConfiguration from './WorkflowConfiguration';
import ResizablePanel from './ResizablePanel';

interface ConfigurationPanelProps {
  selectedTool: Tool | null;
  configuration: ToolConfiguration | null;
  onConfigurationChange: (toolId: string, config: ToolConfiguration) => void;
  onShowNotification: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void;
  workflowMeta: {
    name: string;
    description: string;
    author: string;
    workflowId: string;
    created: string;
  };
  onWorkflowMetaChange: (meta: { name: string; description: string; author: string }) => void;
}

export default function ConfigurationPanel({
  selectedTool,
  configuration,
  onConfigurationChange,
  // onShowNotification,
  workflowMeta,
  onWorkflowMetaChange
}: ConfigurationPanelProps) {
  const [currentConnectionType, setCurrentConnectionType] = useState<ConnectionType | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Reset when tool selection changes
  useEffect(() => {
    if (!selectedTool) {
      setCurrentConnectionType(null);
      setFieldValues({});
      setFieldErrors({});
      return;
    }

    // Load existing configuration if available
    if (configuration) {
      const connectionType = getConnectionType(configuration.connectionType || '');
      setCurrentConnectionType(connectionType || null);
      setFieldValues(configuration.parameters);
    } else {
      // Initialize with default values
      setCurrentConnectionType(null);
      setFieldValues({});
      setFieldErrors({});
    }
  }, [selectedTool, configuration]);

  // Update field value and validate
  const handleFieldChange = (fieldId: string, value: any) => {
    const newValues = { ...fieldValues, [fieldId]: value };
    setFieldValues(newValues);

    // Clear error for this field
    if (fieldErrors[fieldId]) {
      setFieldErrors(prev => ({ ...prev, [fieldId]: '' }));
    }

    // Validate field if it has validation function
    if (currentConnectionType) {
      const field = currentConnectionType.configSchema.find(f => f.id === fieldId);
      if (field?.validation) {
        const error = field.validation(value, newValues);
        if (error) {
          setFieldErrors(prev => ({ ...prev, [fieldId]: error }));
        }
      }
    }

    // Update configuration in parent
    updateConfiguration(newValues);
  };

  // Handle connection type selection
  const handleConnectionTypeChange = (connectionType: ConnectionType) => {
    setCurrentConnectionType(connectionType);
    
    // Initialize field values with defaults
    const defaultValues: Record<string, any> = {};
    connectionType.configSchema.forEach(field => {
      defaultValues[field.id] = field.defaultValue;
    });
    
    setFieldValues(defaultValues);
    setFieldErrors({});
    
    // Update configuration
    updateConfiguration(defaultValues, connectionType.id);
  };

  const handleConnectionTypeClear = () => {
    setCurrentConnectionType(null);
    setFieldValues({});
    setFieldErrors({});
    
    // Update configuration with empty values
    updateConfiguration({}, '');
  };

  // Update configuration in parent component
  const updateConfiguration = (values: Record<string, any>, connectionTypeId?: string) => {
    if (!selectedTool) return;

    const errors = validateAllFields(values);
    const isValid = Object.keys(errors).length === 0;

    const newConfig: ToolConfiguration = {
      toolId: selectedTool.id,
      toolType: selectedTool.type,
      connectionType: connectionTypeId || currentConnectionType?.id || '',
      parameters: values,
      isValid,
      errors: Object.values(errors)
    };

    onConfigurationChange(selectedTool.id, newConfig);
  };

  // Validate all fields
  const validateAllFields = (values: Record<string, any>): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!currentConnectionType) return errors;

    currentConnectionType.configSchema.forEach(field => {
      const value = values[field.id];
      
      // Check required fields
      if (field.required && (!value || value === '')) {
        errors[field.id] = `${field.label} is required`;
        return;
      }

      // Run custom validation
      if (field.validation && value !== null && value !== '') {
        const error = field.validation(value, values);
        if (error) {
          errors[field.id] = error;
        }
      }
    });

    return errors;
  };

  // Show workflow configuration if no tool is selected
  if (!selectedTool) {
    return (
      <ResizablePanel
        defaultWidth={320}
        minWidth={280}
        maxWidth={600}
        className="bg-theme-surface-panel border-r border-theme-border-primary flex flex-col"
      >
        {/* Workflow Configuration Header */}
        <div className="bg-theme-surface-elevated border-b border-theme-border-primary p-4">
          <div className="flex items-center space-x-3">
            <div className="text-2xl">⚙️</div>
            <div>
              <h2 className="text-lg font-semibold text-theme-text-primary">Workflow Configuration</h2>
              <p className="text-sm text-theme-text-tertiary">General workflow settings</p>
            </div>
          </div>
        </div>
        
        {/* Workflow Configuration Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <WorkflowConfiguration
            workflowMeta={workflowMeta}
            onWorkflowMetaChange={onWorkflowMetaChange}
          />
        </div>
      </ResizablePanel>
    );
  }

  // Only show configuration for Input tools for now
  if (selectedTool.type !== 'Input') {
    return (
      <ResizablePanel
        defaultWidth={320}
        minWidth={280}
        maxWidth={600}
        className="bg-theme-surface-panel border-r border-theme-border-primary"
      >
        <ConfigurationHeader tool={selectedTool} />
        <div className="p-4 text-center text-theme-text-tertiary">
          <div className="text-sm">Configuration not available for {selectedTool.type} tools</div>
          <div className="text-xs mt-2 text-theme-text-disabled">Coming soon...</div>
        </div>
      </ResizablePanel>
    );
  }

  return (
    <ResizablePanel
      defaultWidth={320}
      minWidth={280}
      maxWidth={600}
      className="bg-theme-surface-panel border-r border-theme-border-primary flex flex-col"
    >
      {/* Header */}
      <ConfigurationHeader tool={selectedTool} />
      
      {/* Configuration Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Step 1: Connection Type Selection */}
        <div>
          <label className="block text-sm font-medium text-theme-text-secondary mb-2">
            Data Source Category
          </label>
          <ConnectionTypeSelector
            availableTypes={getInputConnectionTypes()}
            selectedType={currentConnectionType}
            onTypeSelect={handleConnectionTypeChange}
            onTypeClear={handleConnectionTypeClear}
          />
        </div>

        {/* Step 2: Configuration Fields */}
        {currentConnectionType && (
          <div className="space-y-4">
            <div className="border-t border-theme-border-primary pt-4">
              <h3 className="text-sm font-medium text-theme-text-secondary mb-3">
                {currentConnectionType.displayName} Configuration
              </h3>
              
              {currentConnectionType.configSchema.map(field => (
                <div key={field.id} className="mb-6">
                  <FieldRenderer
                    field={field}
                    value={fieldValues[field.id]}
                    error={fieldErrors[field.id]}
                    allValues={fieldValues}
                    onChange={(value: any) => handleFieldChange(field.id, value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </ResizablePanel>
  );
}
