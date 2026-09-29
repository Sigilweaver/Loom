import { forwardRef, useImperativeHandle, useRef } from "react";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useUIStore } from "@state/uiStore";
import { runWorkflowValidation } from "@state/validationStore";
import { useWorkflowStore } from "@state/workflowStore";
import { useWorkflowFiles } from "@hooks/useWorkflowFiles";
import { useWorkflowRunner } from "@hooks/useWorkflowRunner";
import SigilWeaverLogo from "./SigilWeaverLogo";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@components/ui/DropdownMenu";

export interface HeaderRef {
  handleSaveWorkflow: () => void;
  handleSaveAsWorkflow: () => void;
  handleImportWorkflow: () => void;
  handleToggleWorkflowViewer: () => void;
  handlePreviewWorkflow: () => void;
  handleRunWorkflow: () => void;
  handleValidateWorkflow: () => void;
}

// Full class strings are spelled out so Tailwind can see them.
const BUTTON_BASE = "px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-border-focus";

const IMPORT_BUTTON = `${BUTTON_BASE} rounded
  bg-theme-header-btn-import-bg border border-theme-header-btn-import-border text-theme-header-btn-import-text
  hover:bg-theme-header-btn-import-bg-hover hover:border-theme-header-btn-import-border-hover hover:text-theme-header-btn-import-text-hover
  active:bg-theme-header-btn-import-bg-active active:border-theme-header-btn-import-border-active active:text-theme-header-btn-import-text-active
  disabled:bg-theme-header-btn-import-bg-disabled disabled:border-theme-header-btn-import-border-disabled disabled:text-theme-header-btn-import-text-disabled`;

const EXPORT_BUTTON = `${BUTTON_BASE} rounded
  bg-theme-header-btn-export-bg border border-theme-header-btn-export-border text-theme-header-btn-export-text
  hover:bg-theme-header-btn-export-bg-hover hover:border-theme-header-btn-export-border-hover hover:text-theme-header-btn-export-text-hover
  active:bg-theme-header-btn-export-bg-active active:border-theme-header-btn-export-border-active active:text-theme-header-btn-export-text-active
  disabled:bg-theme-header-btn-export-bg-disabled disabled:border-theme-header-btn-export-border-disabled disabled:text-theme-header-btn-export-text-disabled`;

const PREVIEW_BUTTON_COLORS = `bg-theme-header-btn-preview-bg border border-theme-header-btn-preview-border text-theme-header-btn-preview-text
  hover:bg-theme-header-btn-preview-bg-hover hover:border-theme-header-btn-preview-border-hover hover:text-theme-header-btn-preview-text-hover
  active:bg-theme-header-btn-preview-bg-active active:border-theme-header-btn-preview-border-active active:text-theme-header-btn-preview-text-active
  disabled:bg-theme-header-btn-preview-bg-disabled disabled:border-theme-header-btn-preview-border-disabled disabled:text-theme-header-btn-preview-text-disabled disabled:cursor-not-allowed`;

const RUN_BUTTON = `${BUTTON_BASE} rounded
  bg-theme-header-btn-run-bg border border-theme-header-btn-run-border text-theme-header-btn-run-text
  hover:bg-theme-header-btn-run-bg-hover hover:border-theme-header-btn-run-border-hover hover:text-theme-header-btn-run-text-hover
  active:bg-theme-header-btn-run-bg-active active:border-theme-header-btn-run-border-active active:text-theme-header-btn-run-text-active
  disabled:bg-theme-header-btn-run-bg-disabled disabled:border-theme-header-btn-run-border-disabled disabled:text-theme-header-btn-run-text-disabled disabled:cursor-not-allowed`;

const truncate = (value: string, max: number) =>
  value.length > max ? value.slice(0, max).trimEnd() + "..." : value;

const Header = forwardRef<HeaderRef, object>((_, ref) => {
  // Header reads tools/wires only inside event handlers. Subscribing to those
  // arrays here would re-render the header on every node drag or config edit.
  const workflowMeta = useWorkflowStore((s) => s.workflowMeta);

  const setLeftPaneTab = useUIStore((s) => s.setLeftPaneTab);
  const setBypassCache = useUIStore((s) => s.setBypassCache);

  const {
    handleNewWorkflow,
    handleImportWorkflow,
    handleSaveWorkflow,
    handleSaveAsWorkflow,
  } = useWorkflowFiles();

  const {
    isPreviewLoading,
    isExecuting,
    bypassCache,
    handlePreviewWorkflow,
    handleClearCache,
    handleRunWorkflow,
  } = useWorkflowRunner();

  const handleToggleWorkflowViewer = () => setLeftPaneTab("workflow");
  const handleValidateWorkflow = () => {
    runWorkflowValidation();
  };

  const handlers = {
    handleNewWorkflow,
    handleImportWorkflow,
    handleSaveWorkflow,
    handleSaveAsWorkflow,
    handleToggleWorkflowViewer,
    handlePreviewWorkflow,
    handleRunWorkflow,
    handleValidateWorkflow,
  };

  // The imperative handle is created once, but the handlers close over
  // per-render state (active tab, workflow name, preview settings). Route the
  // callbacks through a ref so they always run the latest handlers.
  const latestHandlers = useRef(handlers);
  latestHandlers.current = handlers;

  useImperativeHandle(ref, () => ({
    handleSaveWorkflow: () => latestHandlers.current.handleSaveWorkflow(),
    handleSaveAsWorkflow: () => latestHandlers.current.handleSaveAsWorkflow(),
    handleImportWorkflow: () => latestHandlers.current.handleImportWorkflow(),
    handleToggleWorkflowViewer: () => latestHandlers.current.handleToggleWorkflowViewer(),
    handlePreviewWorkflow: () => latestHandlers.current.handlePreviewWorkflow(),
    handleRunWorkflow: () => latestHandlers.current.handleRunWorkflow(),
    handleValidateWorkflow: () => latestHandlers.current.handleValidateWorkflow(),
  }), []);

  return (
    <header className="border-b shadow-lg bg-theme-header-bg border-theme-border-primary">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side - App title and workflow info */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <SigilWeaverLogo
                className="opacity-75 text-theme-header-logo-icon"
                size="md"
              />
              <h1 className="text-xl font-bold text-theme-header-title-text">
                Loom Studio
              </h1>
            </div>
            <div className="text-sm opacity-75 text-theme-header-metadata-text">
              <div className="font-medium" title={workflowMeta.name}>
                {truncate(workflowMeta.name, 60)}
              </div>
            </div>
          </div>

          {/* Right side - Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportWorkflow}
              className={IMPORT_BUTTON}
              title="Open Workflow (Ctrl+O)"
            >
              Open
            </button>

            <button
              onClick={handleSaveWorkflow}
              className={EXPORT_BUTTON}
              title="Save Workflow (Ctrl+S)"
            >
              Save
            </button>

            <button
              onClick={handleSaveAsWorkflow}
              className={EXPORT_BUTTON}
              title="Save Workflow As... (Ctrl+Shift+S)"
            >
              Save As
            </button>

            <div className="w-px h-6 mx-1 opacity-50 bg-theme-header-divider"></div>

            <button
              onClick={handleValidateWorkflow}
              className={`${EXPORT_BUTTON} flex items-center gap-1.5`}
              title="Check the workflow for problems before running it"
            >
              <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              Validate
            </button>

            {/* Preview All with dropdown */}
            <div className="flex">
              <button
                onClick={handlePreviewWorkflow}
                disabled={isPreviewLoading}
                className={`${BUTTON_BASE} rounded-l border-r-0 ${PREVIEW_BUTTON_COLORS}`}
                title={bypassCache ? "Preview All Tools - Cache Bypassed (Ctrl+P)" : "Preview All Tools (Ctrl+P)"}
              >
                {isPreviewLoading ? "Loading..." : bypassCache ? "Preview All*" : "Preview All"}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={isPreviewLoading}
                    className={`${BUTTON_BASE} !px-1.5 rounded-r ${PREVIEW_BUTTON_COLORS}`}
                    title="Preview options"
                    aria-label="Preview options"
                  >
                    <ChevronDown className="w-3 h-3" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuCheckboxItem
                    checked={bypassCache}
                    onCheckedChange={(checked) => setBypassCache(checked)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    Bypass Cache
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={handleClearCache}>
                    Clear Backend Cache
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <button
              onClick={handleRunWorkflow}
              disabled={isExecuting}
              className={RUN_BUTTON}
              title="Run Workflow (F5)"
            >
              {isExecuting ? "Running..." : "Run"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
});

Header.displayName = "Header";

export default Header;
