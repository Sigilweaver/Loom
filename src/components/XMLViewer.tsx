import { Workflow, Tool, Wire } from '../types/workflow';
import { generateWorkflowXML } from '../utils/xmlGenerator';

interface XMLViewerProps {
  isVisible: boolean;
  tools: Tool[];
  wires: Wire[];
  workflowMeta: {
    name: string;
    description: string;
    author: string;
    workflowId: string;
    created: string;
  };
  onClose: () => void;
}

export default function XMLViewer({ 
  isVisible, 
  tools, 
  wires, 
  workflowMeta, 
  onClose 
}: XMLViewerProps) {
  console.log('XMLViewer render - isVisible:', isVisible, 'tools:', tools.length, 'wires:', wires.length);
  
  if (!isVisible) return null;

  // Generate real-time XML
  const workflow: Workflow = {
    version: '1.0',
    xmlns: 'https://example.com/workflow-schema',
    meta: workflowMeta,
    layout: {
      id: 'root',
      name: 'Root Container',
      x: 0,
      y: 0,
      width: 1200,
      height: 800,
      tools: tools,
    },
    wires: wires,
  };

  const xmlContent = generateWorkflowXML(workflow);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(xmlContent);
    // You could add a toast notification here
  };

  // Proper XML syntax highlighting that preserves formatting
  const highlightXML = (xml: string) => {
    return xml
      // Highlight XML tags (opening, closing, self-closing)
      .replace(/(&lt;\/?\s*[\w-]+(?:\s+[\w-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'))?)*\s*\/?\s*&gt;)/g, 
        '<span class="xml-tag">$1</span>')
      // Highlight attribute names
      .replace(/(\s+)([\w-]+)(\s*=)/g, 
        '$1<span class="xml-attr">$2</span>$3')
      // Highlight attribute values
      .replace(/=(\s*)(&quot;[^&]*&quot;|'[^']*')/g, 
        '=$1<span class="xml-value">$2</span>')
      // Highlight CDATA sections
      .replace(/(&lt;!\[CDATA\[[\s\S]*?\]\]&gt;)/g, 
        '<span class="xml-cdata">$1</span>')
      // Highlight XML declaration and processing instructions
      .replace(/(&lt;\?[\s\S]*?\?&gt;)/g, 
        '<span class="xml-declaration">$1</span>');
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const highlightedXML = highlightXML(escapeHtml(xmlContent));

  return (
    <div className="w-96 bg-white border-l border-gray-300 flex flex-col shadow-lg">
      <style>{`
        .xml-tag { color: #0969da; font-weight: 600; }
        .xml-attr { color: #8250df; font-weight: 500; }
        .xml-value { color: #0a3069; }
        .xml-cdata { color: #6f42c1; font-style: italic; }
        .xml-declaration { color: #d73a49; font-weight: 600; }
        .xml-content { font-size: 11px; line-height: 1.4; }
      `}</style>
      
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">XML Live Preview</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="Copy XML to clipboard"
          >
            Copy
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Close XML viewer"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-3">
          <pre 
            className="xml-content font-mono text-gray-800 whitespace-pre-wrap break-words"
            dangerouslySetInnerHTML={{ __html: highlightedXML }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>Tools: {tools.length} | Wires: {wires.length}</span>
          <span className="text-green-600">● Live</span>
        </div>
      </div>
    </div>
  );
}
