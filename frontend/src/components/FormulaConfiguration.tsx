import { ToolConfig, EmissionMap } from "../domain/workflow/entities/workflow";
import { ConfigText } from "./primitives/ConfigText";

interface FormulaConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
}

export function FormulaConfiguration({
  config,
  onChange,
}: FormulaConfigurationProps) {
  const handleColumnNameChange = (
    value: string | undefined,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig = {
      ...config,
      column_name: value || "",
      _emit: {
        ...config._emit,
        ...emitPatch,
      },
    };
    onChange(newConfig);
  };

  const handleExpressionChange = (
    value: string | undefined,
    emitPatch: EmissionMap,
    _shouldEmit: boolean
  ) => {
    const newConfig = {
      ...config,
      expression: value || "",
      _emit: {
        ...config._emit,
        ...emitPatch,
      },
    };
    onChange(newConfig);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 p-4 overflow-y-auto space-y-4">
        {/* Info Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-sm">
          <h3 className="font-semibold text-theme-text-primary mb-2">
            Formula Tool
          </h3>
          <p className="text-theme-text-secondary mb-2">
            Create a new calculated column using Polars expressions. The new
            column will be added to your dataframe.
          </p>
        </div>

        {/* Column Name Input */}
        <div className="space-y-2">
          <ConfigText
            configKey="column_name"
            label="New Column Name"
            value={(config.column_name as string) || ""}
            onChange={handleColumnNameChange}
            placeholder="result"
            description="Name for the new calculated column"
            required
          />
        </div>

        {/* Expression Input */}
        <div className="space-y-2">
          <ConfigText
            configKey="expression"
            label="Formula Expression"
            value={(config.expression as string) || ""}
            onChange={handleExpressionChange}
            placeholder="pl.col('amount') * 1.1"
            variant="textarea"
            rows={4}
            description="Write a Polars expression that calculates the new column value"
            required
          />
        </div>

        {/* Examples Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-xs space-y-3">
          <h4 className="font-semibold text-theme-text-primary mb-2">
            Example Expressions:
          </h4>

          <div className="space-y-2">
            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('price') * pl.col('quantity')
              </div>
              <div className="text-theme-text-tertiary">
                Multiply two columns together
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('amount') * 1.1
              </div>
              <div className="text-theme-text-tertiary">
                Increase values by 10%
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.when(pl.col('x') &gt; 0).then(pl.lit('Positive')).otherwise(pl.lit('Negative'))
              </div>
              <div className="text-theme-text-tertiary">
                Conditional expressions (if-then-else)
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('first_name') + ' ' + pl.col('last_name')
              </div>
              <div className="text-theme-text-tertiary">
                Concatenate text columns
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('date').str.slice(0, 4)
              </div>
              <div className="text-theme-text-tertiary">
                Extract year from date string
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                (pl.col('total') - pl.col('discount')).round(2)
              </div>
              <div className="text-theme-text-tertiary">
                Math operations with rounding
              </div>
            </div>
          </div>
        </div>

        {/* Tips Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-xs">
          <h4 className="font-semibold text-theme-text-primary mb-2">Tips:</h4>
          <ul className="space-y-1 text-theme-text-secondary list-disc list-inside">
            <li>Use pl.col('column_name') to reference existing columns</li>
            <li>Use pl.lit(value) for literal values in expressions</li>
            <li>Chain methods with dots: pl.col('x').abs().sqrt()</li>
            <li>The new column will be appended to the end of your dataframe</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
