import SigilWeaverLogo from './SigilWeaverLogo';
import { ThemeSelector } from './ThemeSelector';

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
    <header className="bg-theme-interactive-primary text-theme-text-inverse shadow-lg border-b border-theme-border-primary">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - App title and workflow info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <SigilWeaverLogo className="text-theme-text-inverse opacity-75" size="md" />
              <h1 className="text-xl font-bold text-theme-text-inverse">Sigilweaver</h1>
            </div>
            <div className="flex items-center gap-4 text-sm text-theme-text-inverse opacity-75">
              <span className="font-medium">{workflowMeta.name}</span>
              <span>•</span>
              <span>{toolCount} tools</span>
              <span>•</span>
              <span>{wireCount} connections</span>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2">
            <ThemeSelector className="mr-2" />
            
            <button
              onClick={onNewWorkflow}
              className="px-3 py-1.5 bg-theme-success-accent hover:bg-theme-success-text rounded text-sm font-medium transition-colors text-theme-text-inverse"
              title="New Workflow (Ctrl+N)"
            >
              New
            </button>
            
            <button
              onClick={onImportWorkflow}
              className="px-3 py-1.5 bg-theme-interactive-secondary hover:bg-theme-interactive-secondary-hover rounded text-sm font-medium transition-colors text-theme-text-inverse"
              title="Import Workflow (Ctrl+I)"
            >
              Import
            </button>
            
            <button
              onClick={onExportXML}
              className="px-3 py-1.5 bg-theme-interactive-primary-hover hover:bg-theme-interactive-primary-active rounded text-sm font-medium transition-colors text-theme-text-inverse"
              title="Export Workflow (Ctrl+E)"
            >
              Export
            </button>
            
            <button
              onClick={onShowXMLViewer}
              className="px-3 py-1.5 bg-theme-interactive-secondary hover:bg-theme-interactive-secondary-hover rounded text-sm font-medium transition-colors text-theme-text-inverse"
              title="Show XML Viewer (Ctrl+Alt+X)"
            >
              View Code
            </button>

            <div className="w-px h-6 bg-theme-text-inverse opacity-50 mx-1"></div>
            
            <button
              onClick={onPreviewWorkflow}
              className="px-3 py-1.5 bg-theme-interactive-accent hover:bg-theme-interactive-accent-hover rounded text-sm font-medium transition-colors text-theme-text-inverse"
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
              className="px-3 py-1.5 bg-theme-error-accent hover:bg-theme-error-text rounded text-sm font-medium transition-colors text-theme-text-inverse"
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
