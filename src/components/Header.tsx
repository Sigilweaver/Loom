interface HeaderProps {
  onNewWorkflow: () => void;
  onImportWorkflow: () => void;
  onExportXML: () => void;
  onShowXMLViewer: () => void;
  onPreviewWorkflow: () => void;
  onShowNotification?: (message: string, type: 'error' | 'warning' | 'success' | 'info') => void;
  workflowMeta: {
    name: string;
    description: string;
    author: string;
    workflowId: string;
    created: string;
  };
  toolCount: number;
  wireCount: number;
}

export default function Header({ 
  onNewWorkflow, 
  onImportWorkflow,
  onExportXML, 
  onShowXMLViewer, 
  onPreviewWorkflow,
  onShowNotification,
  workflowMeta,
  toolCount,
  wireCount
}: HeaderProps) {
  return (
    <header className="bg-gray-800 text-white shadow-lg">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - App title and workflow info */}
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-blue-400">Workflow Designer</h1>
            <div className="flex items-center gap-4 text-sm text-gray-300">
              <span className="font-medium">{workflowMeta.name}</span>
              <span>•</span>
              <span>{toolCount} tools</span>
              <span>•</span>
              <span>{wireCount} connections</span>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onNewWorkflow}
              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded text-sm font-medium transition-colors"
              title="New Workflow (Ctrl+N)"
            >
              New
            </button>
            
            <button
              onClick={onImportWorkflow}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 rounded text-sm font-medium transition-colors"
              title="Import Workflow (Ctrl+I)"
            >
              Import
            </button>
            
            <button
              onClick={onExportXML}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm font-medium transition-colors"
              title="Export Workflow (Ctrl+E)"
            >
              Export
            </button>
            
            <button
              onClick={onShowXMLViewer}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors"
              title="Show XML Viewer (Ctrl+Alt+X)"
            >
              View Code
            </button>

            <div className="w-px h-6 bg-gray-600 mx-1"></div>
            
            <button
              onClick={onPreviewWorkflow}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded text-sm font-medium transition-colors"
              title="Preview Workflow Results (Ctrl+P)"
            >
              Preview
            </button>
            
            <button
              onClick={() => {
                if (confirm('This will run the workflow. Continue?')) {
                  onShowNotification?.('Workflow execution not yet implemented', 'info');
                }
              }}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-sm font-medium transition-colors"
              title="Run Workflow (F5)"
            >
              Run
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
