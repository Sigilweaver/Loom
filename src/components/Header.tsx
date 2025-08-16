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
}

export default function Header({ 
  onNewWorkflow, 
  onImportWorkflow,
  onExportXML, 
  onShowXMLViewer, 
  onPreviewWorkflow,
  onShowNotification,
  workflowMeta
}: HeaderProps) {
  const truncate = (value: string, max: number) =>
    value.length > max ? value.slice(0, max).trimEnd() + '…' : value;

  const truncatedWorkflowName = truncate(workflowMeta.name, 60);
  return (
    <header className="bg-theme-header-bg shadow-lg border-b border-theme-border-primary">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - App title and workflow info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <SigilWeaverLogo className="text-theme-header-logo-icon opacity-75" size="md" />
              <h1 className="text-xl font-bold text-theme-header-title-text">Sigilweaver</h1>
            </div>
            <div className="text-sm text-theme-header-metadata-text opacity-75">
              <span className="font-medium" title={workflowMeta.name}>{truncatedWorkflowName}</span>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2">
            <ThemeSelector className="mr-2" />
            
            <button
              onClick={onNewWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-new-bg border border-theme-header-btn-new-border text-theme-header-btn-new-text
                hover:bg-theme-header-btn-new-bg-hover hover:border-theme-header-btn-new-border-hover hover:text-theme-header-btn-new-text-hover
                active:bg-theme-header-btn-new-bg-active active:border-theme-header-btn-new-border-active active:text-theme-header-btn-new-text-active
                disabled:bg-theme-header-btn-new-bg-disabled disabled:border-theme-header-btn-new-border-disabled disabled:text-theme-header-btn-new-text-disabled"
              title="New Workflow (Ctrl+N)"
            >
              New
            </button>
            
            <button
              onClick={onImportWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-import-bg border border-theme-header-btn-import-border text-theme-header-btn-import-text
                hover:bg-theme-header-btn-import-bg-hover hover:border-theme-header-btn-import-border-hover hover:text-theme-header-btn-import-text-hover
                active:bg-theme-header-btn-import-bg-active active:border-theme-header-btn-import-border-active active:text-theme-header-btn-import-text-active
                disabled:bg-theme-header-btn-import-bg-disabled disabled:border-theme-header-btn-import-border-disabled disabled:text-theme-header-btn-import-text-disabled"
              title="Import Workflow (Ctrl+I)"
            >
              Import
            </button>
            
            <button
              onClick={onExportXML}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-export-bg border border-theme-header-btn-export-border text-theme-header-btn-export-text
                hover:bg-theme-header-btn-export-bg-hover hover:border-theme-header-btn-export-border-hover hover:text-theme-header-btn-export-text-hover
                active:bg-theme-header-btn-export-bg-active active:border-theme-header-btn-export-border-active active:text-theme-header-btn-export-text-active
                disabled:bg-theme-header-btn-export-bg-disabled disabled:border-theme-header-btn-export-border-disabled disabled:text-theme-header-btn-export-text-disabled"
              title="Export Workflow (Ctrl+E)"
            >
              Export
            </button>
            
            <button
              onClick={onShowXMLViewer}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-viewcode-bg border border-theme-header-btn-viewcode-border text-theme-header-btn-viewcode-text
                hover:bg-theme-header-btn-viewcode-bg-hover hover:border-theme-header-btn-viewcode-border-hover hover:text-theme-header-btn-viewcode-text-hover
                active:bg-theme-header-btn-viewcode-bg-active active:border-theme-header-btn-viewcode-border-active active:text-theme-header-btn-viewcode-text-active
                disabled:bg-theme-header-btn-viewcode-bg-disabled disabled:border-theme-header-btn-viewcode-border-disabled disabled:text-theme-header-btn-viewcode-text-disabled"
              title="Show XML Viewer (Ctrl+Alt+X)"
            >
              View Code
            </button>

            <div className="w-px h-6 bg-theme-header-divider opacity-50 mx-1"></div>
            
            <button
              onClick={onPreviewWorkflow}
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-preview-bg border border-theme-header-btn-preview-border text-theme-header-btn-preview-text
                hover:bg-theme-header-btn-preview-bg-hover hover:border-theme-header-btn-preview-border-hover hover:text-theme-header-btn-preview-text-hover
                active:bg-theme-header-btn-preview-bg-active active:border-theme-header-btn-preview-border-active active:text-theme-header-btn-preview-text-active
                disabled:bg-theme-header-btn-preview-bg-disabled disabled:border-theme-header-btn-preview-border-disabled disabled:text-theme-header-btn-preview-text-disabled"
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
              className="px-3 py-1.5 rounded text-sm font-medium transition-colors
                bg-theme-header-btn-run-bg border border-theme-header-btn-run-border text-theme-header-btn-run-text
                hover:bg-theme-header-btn-run-bg-hover hover:border-theme-header-btn-run-border-hover hover:text-theme-header-btn-run-text-hover
                active:bg-theme-header-btn-run-bg-active active:border-theme-header-btn-run-border-active active:text-theme-header-btn-run-text-active
                disabled:bg-theme-header-btn-run-bg-disabled disabled:border-theme-header-btn-run-border-disabled disabled:text-theme-header-btn-run-text-disabled"
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
