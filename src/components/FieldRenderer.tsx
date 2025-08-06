import { FieldSchema } from '../types/configuration';

interface FieldRendererProps {
  field: FieldSchema;
  value: any;
  error?: string;
  allValues: Record<string, any>;
  onChange: (value: any) => void;
}

export default function FieldRenderer({
  field,
  value,
  error,
  allValues,
  onChange
}: FieldRendererProps) {
  
  // Check if field should be shown based on dependencies
  const shouldShow = () => {
    if (!field.dependsOn) return true;
    
    const dependentValue = allValues[field.dependsOn];
    // For now, simple logic: show if dependent field has value 'custom'
    // This can be extended for more complex dependency logic
    return dependentValue === 'custom';
  };

  // Don't render if dependencies aren't met
  if (!shouldShow()) {
    return null;
  }

  const renderField = () => {
    switch (field.type) {
      case 'text':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md text-sm bg-theme-surface-elevated text-theme-text-primary
              ${error 
                ? 'border-red-500 focus:border-red-600 focus:ring-red-500' 
                : 'border-theme-border-primary focus:border-theme-border-focus focus:ring-theme-border-focus'
              }
              focus:outline-none focus:ring-1
            `}
            placeholder={field.helpText}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            className={`
              w-full px-3 py-2 border rounded-md text-sm bg-theme-surface-elevated text-theme-text-primary
              ${error 
                ? 'border-red-500 focus:border-red-600 focus:ring-red-500' 
                : 'border-theme-border-primary focus:border-theme-border-focus focus:ring-theme-border-focus'
              }
              focus:outline-none focus:ring-1
            `}
            placeholder={field.helpText}
          />
        );

      case 'boolean':
        return (
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
              className="rounded border-theme-border-primary text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-theme-text-primary">
              {field.helpText || 'Enable this option'}
            </span>
          </label>
        );

      case 'select':
        return (
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={`
              w-full px-3 py-2 border rounded-md text-sm bg-theme-surface-elevated text-theme-text-primary
              ${error 
                ? 'border-red-500 focus:border-red-600 focus:ring-red-500' 
                : 'border-theme-border-primary focus:border-theme-border-focus focus:ring-theme-border-focus'
              }
              focus:outline-none focus:ring-1
            `}
          >
            <option value="">Select {field.label.toLowerCase()}...</option>
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      case 'file':
        return (
          <div className="space-y-2">
            <input
              type="text"
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={`
                w-full px-3 py-2 border rounded-md text-sm bg-theme-surface-elevated text-theme-text-primary
                ${error 
                  ? 'border-red-500 focus:border-red-600 focus:ring-red-500' 
                  : 'border-theme-border-primary focus:border-theme-border-focus focus:ring-theme-border-focus'
                }
                focus:outline-none focus:ring-1
              `}
              placeholder="Copy and paste file path here..."
            />
            <div className="text-xs text-theme-text-tertiary">
              💡 Copy the full file path from your file explorer and paste it here
            </div>
          </div>
        );

      default:
        return (
          <div className="text-sm text-theme-text-tertiary">
            Unsupported field type: {field.type}
          </div>
        );
    }
  };

  return (
    <div className="space-y-3">
      {/* Field Label */}
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-theme-text-secondary">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      </div>

      {/* Field Input */}
      {renderField()}

      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-600 flex items-center space-x-1">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Help Text */}
      {field.helpText && !error && field.type !== 'boolean' && (
        <div className="text-xs text-theme-text-tertiary">
          {field.helpText}
        </div>
      )}
    </div>
  );
}
