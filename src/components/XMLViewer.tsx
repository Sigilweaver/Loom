import React, { useState } from 'react';

interface XMLViewerProps {
  isVisible: boolean;
  xmlContent: string;
  onClose: () => void;
}

// Function to format XML with proper indentation
function formatXML(xml: string): string {
  const PADDING = '  '; // 2 spaces for each level
  
  // First, normalize the XML by removing existing formatting
  let formatted = xml.replace(/>\s*</g, '><');
  
  // Add line breaks between tags
  formatted = formatted.replace(/(>)(<)(\/*)/g, '$1\n$2$3');
  
  let pad = 0;
  
  return formatted.split('\n').map((line) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return '';
    
    let indent = 0;
    let adjustPadAfter = 0;
    
    if (trimmedLine.match(/^<\/\w/)) {
      // Closing tag - decrease indent before this line
      indent = -1;
    } else if (trimmedLine.match(/^<\w[^>]*[^\/]>$/)) {
      // Opening tag that's not self-closing - increase indent after this line
      adjustPadAfter = 1;
    } else if (trimmedLine.match(/^<\w.*\/>/)) {
      // Self-closing tag - no indent change
      indent = 0;
    } else if (trimmedLine.match(/^<\?/) || trimmedLine.match(/^<!--/)) {
      // XML declaration or comment - no indent change
      indent = 0;
    }
    
    // Apply indent to current line
    const currentPad = Math.max(0, pad + indent);
    const padding = PADDING.repeat(currentPad);
    
    // Adjust pad for next line
    pad = Math.max(0, pad + indent + adjustPadAfter);
    
    return padding + trimmedLine;
  }).filter(line => line.trim()).join('\n');
}

// Simple XML syntax highlighter
function highlightXML(xml: string): JSX.Element[] {
  const lines = xml.split('\n');
  
  return lines.map((lineText, index) => {
    // Preserve leading whitespace (indentation)
    const leadingWhitespace = lineText.match(/^(\s*)/)?.[1] || '';
    const trimmedLine = lineText.trim();
    
    if (!trimmedLine) {
      return <div key={index} className="leading-relaxed h-6"></div>;
    }
    
    const parts: JSX.Element[] = [];
    let currentIndex = 0;
    let partKey = 0;
    
    // Add leading whitespace first
    if (leadingWhitespace) {
      parts.push(
        <span key={partKey++} className="whitespace-pre">
          {leadingWhitespace}
        </span>
      );
    }
    
    // Helper function to add text with a specific style
    const addPart = (text: string, className: string = 'text-gray-800') => {
      if (text) {
        parts.push(
          <span key={partKey++} className={className}>
            {text}
          </span>
        );
      }
    };
    
    // Parse the trimmed line for different XML components
    const xmlRegex = /(<\?[^>]*\?>|<!--[^>]*-->|<!\[CDATA\[.*?\]\]>|<\/?\w+[^>]*>)/g;
    let match;
    
    while ((match = xmlRegex.exec(trimmedLine)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        const textBefore = trimmedLine.substring(currentIndex, match.index);
        addPart(textBefore, 'text-gray-800');
      }
      
      const xmlElement = match[0];
      
      // Determine the type of XML element and apply appropriate styling
      if (xmlElement.startsWith('<?')) {
        // XML declaration
        addPart(xmlElement, 'text-purple-600 font-medium');
      } else if (xmlElement.startsWith('<!--')) {
        // Comment
        addPart(xmlElement, 'text-green-600 italic');
      } else if (xmlElement.startsWith('<![CDATA[')) {
        // CDATA
        addPart(xmlElement, 'text-yellow-700 bg-yellow-50');
      } else if (xmlElement.startsWith('</')) {
        // Closing tag
        const tagMatch = xmlElement.match(/<\/(\w+)>/);
        if (tagMatch) {
          addPart('</', 'text-blue-600');
          addPart(tagMatch[1], 'text-blue-800 font-semibold');
          addPart('>', 'text-blue-600');
        } else {
          addPart(xmlElement, 'text-blue-600');
        }
      } else if (xmlElement.startsWith('<')) {
        // Opening tag with potential attributes
        const tagParts = xmlElement.match(/^(<)(\w+)(.*?)(\/?>)$/);
        if (tagParts) {
          addPart(tagParts[1], 'text-blue-600'); // <
          addPart(tagParts[2], 'text-blue-800 font-semibold'); // tag name
          
          // Parse attributes
          const attributes = tagParts[3];
          const attrRegex = /\s+(\w+)="([^"]*)"/g;
          let attrMatch;
          let lastAttrIndex = 0;
          
          while ((attrMatch = attrRegex.exec(attributes)) !== null) {
            // Add any whitespace/text before attribute
            if (attrMatch.index > lastAttrIndex) {
              addPart(attributes.substring(lastAttrIndex, attrMatch.index), 'text-gray-600');
            }
            
            addPart(' ', 'text-gray-600');
            addPart(attrMatch[1], 'text-green-600'); // attribute name
            addPart('=', 'text-gray-600');
            addPart('"', 'text-red-500');
            addPart(attrMatch[2], 'text-red-500'); // attribute value
            addPart('"', 'text-red-500');
            
            lastAttrIndex = attrMatch.index + attrMatch[0].length;
          }
          
          // Add remaining part of attributes
          if (lastAttrIndex < attributes.length) {
            addPart(attributes.substring(lastAttrIndex), 'text-gray-600');
          }
          
          addPart(tagParts[4], 'text-blue-600'); // /> or >
        } else {
          addPart(xmlElement, 'text-blue-600');
        }
      }
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add any remaining text
    if (currentIndex < trimmedLine.length) {
      addPart(trimmedLine.substring(currentIndex), 'text-gray-800');
    }
    
    return (
      <div key={index} className="leading-relaxed font-mono">
        {parts.length > 0 ? parts : <span className="text-gray-800">{trimmedLine}</span>}
      </div>
    );
  });
}

export default function XMLViewer({ 
  isVisible, 
  xmlContent,
  onClose 
}: XMLViewerProps) {
  const [width, setWidth] = useState(384); // Default width (w-96 = 384px)
  const [isResizing, setIsResizing] = useState(false);

  if (!isVisible) return null;

  const formattedXml = formatXML(xmlContent);
  const highlightedXml = highlightXML(formattedXml);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formattedXml);
      // Could add notification here if needed
    } catch (err) {
      console.error('Failed to copy XML:', err);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = window.innerWidth - e.clientX;
    setWidth(Math.max(300, Math.min(800, newWidth))); // Min 300px, max 800px
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add global mouse event listeners when resizing
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing]);

  return (
    <div 
      className="bg-white border-l border-gray-300 flex flex-col h-full relative"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-blue-500 transition-colors z-10"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      />
      
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-gray-50">
        {/* Code icon */}
        <div className="flex-shrink-0">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-800">XML Viewer</h2>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium transition-colors"
            title="Copy formatted XML to clipboard"
          >
            Copy
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium transition-colors"
            title="Close XML viewer"
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* Description below header */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
        <p className="text-sm text-blue-700">
          Live XML representation of the current workflow
        </p>
      </div>
      
      {/* XML Content with syntax highlighting */}
      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        <div className="bg-white p-4 rounded border font-mono text-xs leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
          {highlightedXml}
        </div>
      </div>
    </div>
  );
}
