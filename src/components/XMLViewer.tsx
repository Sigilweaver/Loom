interface XMLViewerProps {
  isVisible: boolean;
  xmlContent: string;
  onClose: () => void;
}

export default function XMLViewer({ 
  isVisible, 
  xmlContent,
  onClose 
}: XMLViewerProps) {
  if (!isVisible) return null;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(xmlContent);
      // Could add notification here if needed
    } catch (err) {
      console.error('Failed to copy XML:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-3/4 h-3/4 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Workflow XML</h2>
          <div className="flex gap-2">
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
            >
              Copy XML
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>
        
        {/* XML Content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-50">
          <pre className="text-sm font-mono whitespace-pre-wrap break-words bg-white p-4 rounded border">
            {xmlContent}
          </pre>
        </div>
      </div>
    </div>
  );
}
