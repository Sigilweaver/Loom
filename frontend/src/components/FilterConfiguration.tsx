import { ToolConfig } from "../domain/workflow/entities/workflow";
import { CodeEditor } from "./common/CodeEditor";

interface FilterConfigurationProps {
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
}

export function FilterConfiguration({
  config,
  onChange,
}: FilterConfigurationProps) {
  const handleExpressionChange = (value: string) => {
    const newConfig = {
      ...config,
      expression: value || "",
      _emit: {
        ...config._emit,
        expression: true,
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
            Filter Tool
          </h3>
          <p className="text-theme-text-secondary mb-2">
            Split data based on a condition. Rows matching the expression go to
            the True (T) output, others go to False (F).
          </p>
        </div>

        {/* Expression Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-theme-text-primary">
            Filter Expression
          </label>
          <div className="border border-theme-border rounded overflow-hidden">
            <CodeEditor
              value={(config.expression as string) || ""}
              onChange={handleExpressionChange}
              language="python"
              height="120px"
              placeholder="pl.col('amount') > 100"
            />
          </div>
          <p className="text-xs text-theme-text-tertiary">
            Write a Polars expression that returns True/False for each row
          </p>
        </div>

        {/* Examples Section */}
        <div className="p-3 bg-theme-surface-elevated rounded text-xs space-y-3">
          <h4 className="font-semibold text-theme-text-primary mb-2">
            Example Expressions:
          </h4>

          <div className="space-y-2">
            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('age') &gt; 30
              </div>
              <div className="text-theme-text-tertiary">
                Filter rows where age is greater than 30
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('status') == 'active'
              </div>
              <div className="text-theme-text-tertiary">
                Filter rows where status equals 'active'
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                (pl.col('a') &gt; 10) &amp; (pl.col('b') &lt; 20)
              </div>
              <div className="text-theme-text-tertiary">
                Multiple conditions with AND
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('name').str.contains('test')
              </div>
              <div className="text-theme-text-tertiary">
                Filter rows where name contains 'test'
              </div>
            </div>

            <div>
              <div className="font-mono text-theme-text-primary bg-theme-surface-panel p-2 rounded mb-1">
                pl.col('value').is_not_null()
              </div>
              <div className="text-theme-text-tertiary">
                Filter out null values
              </div>
            </div>
          </div>
        </div>

        {/* Output Sockets Info */}
        <div className="p-3 bg-theme-surface-elevated rounded text-xs">
          <h4 className="font-semibold text-theme-text-primary mb-2">
            Output Sockets:
          </h4>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono bg-theme-surface-panel px-2 py-0.5 rounded text-green-500">
                T
              </span>
              <span className="text-theme-text-secondary">
                Rows where expression is True
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono bg-theme-surface-panel px-2 py-0.5 rounded text-red-500">
                F
              </span>
              <span className="text-theme-text-secondary">
                Rows where expression is False
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
