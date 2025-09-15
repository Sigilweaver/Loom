import React from 'react';

export interface ConfigBooleanProps {
  value: boolean | string | undefined; // Allow undefined for "not set" state
  onChange: (value: boolean | undefined) => void; // undefined = use default (don't emit)
  label?: string;
  description?: string;
  defaultValue?: boolean;
  disabled?: boolean;
}

/**
 * Utility function to check if a boolean value should be emitted in XML
 * (only emit when different from default)
 */
export const shouldEmitBoolean = (
  value: boolean | string | undefined, 
  defaultValue: boolean = false
): boolean => {
  if (value === undefined) return false;
  const booleanValue = typeof value === 'string' ? value === 'true' : Boolean(value);
  return booleanValue !== defaultValue;
};

/**
 * Utility function to get the boolean value for XML emission
 */
export const getBooleanForXML = (
  value: boolean | string | undefined
): boolean => {
  return typeof value === 'string' ? value === 'true' : Boolean(value);
};

/**
 * Simple boolean checkbox primitive with no business logic
 * Tracks value vs defaultValue for XML emission logic
 * 
 * @example
 * // Simple checkbox
 * <ConfigBoolean 
 *   value={hasHeader} 
 *   onChange={setHasHeader} 
 *   label="Has Header Row" 
 * />
 * 
 * // With default value tracking
 * <ConfigBoolean 
 *   value={skipRows} 
 *   onChange={setSkipRows} 
 *   label="Skip Initial Rows"
 *   defaultValue={false}
 *   description="Skip the first row when reading"
 * />
 */
export const ConfigBoolean: React.FC<ConfigBooleanProps> = ({
  value,
  onChange,
  label = "Enable Option",
  description,
  defaultValue = false,
  disabled = false
}) => {
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    
    // Core philosophy: Only emit values that differ from defaults
    // If the new value equals the default, pass undefined (don't emit)
    if (newValue === defaultValue) {
      onChange(undefined);
    } else {
      onChange(newValue);
    }
  };

  // Get the effective boolean value for display (use default if undefined)
  const effectiveValue = value === undefined ? defaultValue : getBooleanForXML(value);
  
  // Check if this value would be emitted in XML
  const willEmitInXML = shouldEmitBoolean(value, defaultValue);

  return (
    <div>
      <div className="flex items-start space-x-3">
        <input
          type="checkbox"
          checked={effectiveValue}
          onChange={handleChange}
          disabled={disabled}
          className="mt-1 h-4 w-4 text-theme-interactive-accent rounded border-theme-border-primary 
                     focus:ring-1 focus:ring-theme-border-focus focus:ring-offset-0
                     disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <div className="flex-1">
          <label className="text-sm font-medium text-theme-text-primary cursor-pointer select-none">
            {label}
          </label>
          {description && (
            <p className="text-xs text-theme-text-tertiary mt-1">
              {description}
            </p>
          )}
          {/* Subtle indicator when value will be emitted in XML */}
          {willEmitInXML && (
            <div className="text-xs text-theme-text-disabled mt-1">
              • Will override default ({defaultValue.toString()}) in XML
            </div>
          )}
        </div>
      </div>
    </div>
  );
};