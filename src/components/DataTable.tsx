import { useUIStore } from "@state/uiStore";

export interface ColumnSchema {
  name: string;
  dtype: string;
  nullable: boolean;
}

const DataTable = () => {
  const previewState = useUIStore((s) => s.previewState);

  if (!previewState) {
    return (
      <div className="flex items-center justify-center h-full text-theme-text-secondary text-sm">
        No preview data available. Click a socket on the canvas to preview its data.
      </div>
    );
  }

  if (previewState.loading) {
    return (
      <div className="flex items-center justify-center h-full text-theme-text-secondary text-sm">
        Loading preview...
      </div>
    );
  }

  if (previewState.error) {
    return (
      <div className="flex items-center justify-center h-full text-theme-error text-sm">
        Error: {previewState.error}
      </div>
    );
  }

  const { schema, data } = previewState;

  if (!schema || schema.length === 0 || !data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-theme-text-secondary text-sm">
        No data available for this socket.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header Info */}
      <div className="mb-3 p-2 bg-theme-surface-elevated rounded text-xs text-theme-text-secondary">
        <strong>{data.length}</strong> rows ×{" "}
        <strong>{schema.length}</strong> columns
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-theme-surface-elevated border-b-2 border-theme-border-primary">
              {schema.map((col) => (
                <th
                  key={col.name}
                  className="px-3 py-2 text-left font-semibold text-theme-text-primary"
                >
                  <div>{col.name}</div>
                  <div className="text-xs font-normal text-theme-text-secondary mt-0.5">
                    {col.dtype}
                    {col.nullable && " (nullable)"}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr
                key={idx}
                className={`border-b border-theme-border-secondary ${
                  idx % 2 === 0 ? "" : "bg-theme-surface-elevated"
                }`}
              >
                {schema.map((col) => (
                  <td
                    key={col.name}
                    className="px-3 py-2 text-theme-text-primary"
                  >
                    {row[col.name] === null || row[col.name] === undefined ? (
                      <span className="text-theme-text-secondary italic">null</span>
                    ) : (
                      String(row[col.name])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataTable;
