/* eslint-disable no-useless-escape -- Regex patterns include forward slashes and character classes; disabling to keep readable explicit escaping */
import React, { useState } from "react";

interface XMLViewerProps {
  isVisible: boolean;
  xmlContent: string; // Can be XML or JSON
  onClose: () => void;
}

// Detect if content is JSON
function isJSON(content: string): boolean {
  try {
    const trimmed = content.trim();
    return (
      (trimmed.startsWith("{") || trimmed.startsWith("[")) &&
      JSON.parse(trimmed) !== undefined
    );
  } catch {
    return false;
  }
}

// Function to format JSON with proper indentation
function formatJSON(json: string): string {
  try {
    const parsed = JSON.parse(json);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return json;
  }
}

// Function to format XML with proper indentation
function formatXML(xml: string): string {
  const PADDING = "  "; // 2 spaces for each level

  // First, normalize the XML by removing existing formatting
  // Collapse whitespace between tags
  let formatted = xml.replace(/>\s+</g, "><");

  // Add line breaks between tags
  // Insert newline between adjacent tags
  formatted = formatted.replace(/></g, ">\n<");

  let pad = 0;

  return formatted
    .split("\n")
    .map((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return "";

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
    })
    .filter((line) => line.trim())
    .join("\n");
}

// Simple JSON syntax highlighter
function highlightJSON(json: string): JSX.Element[] {
  const lines = json.split("\n");

  return lines.map((line, index) => {
    const leadingWhitespace = line.match(/^(\s*)/)?.[1] || "";
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      return <div key={index} className="leading-relaxed h-6"></div>;
    }

    const parts: JSX.Element[] = [];
    let partKey = 0;

    // Add leading whitespace
    if (leadingWhitespace) {
      parts.push(
        <span key={partKey++} className="whitespace-pre">
          {leadingWhitespace}
        </span>
      );
    }

    // JSON syntax highlighting regex
    const jsonRegex =
      /("(?:[^"\\]|\\.)*")|(\d+\.?\d*)|(\btrue\b|\bfalse\b|\bnull\b)|([\{\}\[\],:])/g;
    let lastIndex = 0;
    let match;

    while ((match = jsonRegex.exec(trimmedLine)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(
          <span key={partKey++} className="text-theme-syntax-text">
            {trimmedLine.substring(lastIndex, match.index)}
          </span>
        );
      }

      if (match[1]) {
        // String (property name or value)
        const str = match[1];
        // Check if it's a property name (followed by :)
        const nextChar = trimmedLine[match.index + str.length];
        if (nextChar === ":") {
          parts.push(
            <span
              key={partKey++}
              className="text-theme-syntax-attribute font-medium"
            >
              {str}
            </span>
          );
        } else {
          parts.push(
            <span key={partKey++} className="text-theme-syntax-value">
              {str}
            </span>
          );
        }
      } else if (match[2]) {
        // Number
        parts.push(
          <span key={partKey++} className="text-theme-syntax-number">
            {match[2]}
          </span>
        );
      } else if (match[3]) {
        // Boolean or null
        parts.push(
          <span
            key={partKey++}
            className="text-theme-syntax-keyword font-medium"
          >
            {match[3]}
          </span>
        );
      } else if (match[4]) {
        // Punctuation
        parts.push(
          <span key={partKey++} className="text-theme-syntax-tag">
            {match[4]}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < trimmedLine.length) {
      parts.push(
        <span key={partKey++} className="text-theme-syntax-text">
          {trimmedLine.substring(lastIndex)}
        </span>
      );
    }

    return (
      <div key={index} className="leading-relaxed font-mono">
        {parts.length > 0 ? (
          parts
        ) : (
          <span className="text-theme-syntax-text">{trimmedLine}</span>
        )}
      </div>
    );
  });
}

// Simple XML syntax highlighter
function highlightXML(xml: string): JSX.Element[] {
  const lines = xml.split("\n");

  return lines.map((lineText, index) => {
    // Preserve leading whitespace (indentation)
    const leadingWhitespace = lineText.match(/^(\s*)/)?.[1] || "";
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
    const addPart = (
      text: string,
      className: string = "text-theme-syntax-text"
    ) => {
      if (text) {
        parts.push(
          <span key={partKey++} className={className}>
            {text}
          </span>
        );
      }
    };

    // Parse the trimmed line for different XML components
    const xmlRegex =
      /(<\?[^>]*\?>|<!--[^>]*-->|<!\[CDATA\[.*?\]\]>|<[/]?\w+[^>]*>)/g;
    let match;

    while ((match = xmlRegex.exec(trimmedLine)) !== null) {
      // Add text before the match
      if (match.index > currentIndex) {
        const textBefore = trimmedLine.substring(currentIndex, match.index);
        addPart(textBefore, "text-theme-syntax-text");
      }

      const xmlElement = match[0];

      // Determine the type of XML element and apply appropriate styling
      if (xmlElement.startsWith("<?")) {
        // XML declaration
        addPart(xmlElement, "text-theme-syntax-declaration font-medium");
      } else if (xmlElement.startsWith("<!--")) {
        // Comment
        addPart(xmlElement, "text-theme-syntax-comment italic");
      } else if (xmlElement.startsWith("<![CDATA[")) {
        // CDATA
        addPart(xmlElement, "text-yellow-700 bg-yellow-50");
      } else if (xmlElement.startsWith("</")) {
        // Closing tag (use RegExp constructor to avoid escaped forward slash in literal)
        const closingTagRegex = new RegExp("</(\\w+)>");
        const tagMatch = xmlElement.match(closingTagRegex);
        if (tagMatch) {
          addPart("</", "text-theme-syntax-tag");
          if (tagMatch[1])
            addPart(tagMatch[1], "text-theme-syntax-tag font-semibold");
          addPart(">", "text-theme-syntax-tag");
        } else {
          addPart(xmlElement, "text-theme-syntax-tag");
        }
      } else if (xmlElement.startsWith("<")) {
        // Opening tag with potential attributes
        const tagParts = xmlElement.match(/^(<)(\w+)(.*?)(\/?>)$/);
        if (tagParts) {
          if (tagParts[1]) addPart(tagParts[1], "text-theme-syntax-tag"); // <
          if (tagParts[2])
            addPart(tagParts[2], "text-theme-syntax-tag font-semibold"); // tag name

          // Parse attributes
          const attributes = tagParts[3] || "";
          const attrRegex = /\s+(\w+)="([^"]*)"/g;
          let attrMatch;
          let lastAttrIndex = 0;

          while ((attrMatch = attrRegex.exec(attributes)) !== null) {
            // Add any whitespace/text before attribute
            if (attrMatch.index > lastAttrIndex) {
              addPart(
                attributes.substring(lastAttrIndex, attrMatch.index),
                "text-theme-text-tertiary"
              );
            }

            addPart(" ", "text-theme-text-tertiary");
            if (attrMatch[1]) {
              addPart(attrMatch[1], "text-theme-syntax-attribute"); // attribute name
            }
            addPart("=", "text-theme-text-tertiary");
            addPart('"', "text-theme-syntax-value");
            if (attrMatch[2]) {
              addPart(attrMatch[2], "text-theme-syntax-value"); // attribute value
            }
            addPart('"', "text-theme-syntax-value");

            lastAttrIndex = attrMatch.index + attrMatch[0].length;
          }

          // Add remaining part of attributes
          if (lastAttrIndex < attributes.length) {
            addPart(
              attributes.substring(lastAttrIndex),
              "text-theme-text-tertiary"
            );
          }

          if (tagParts[4]) addPart(tagParts[4], "text-theme-syntax-tag"); // /> or >
        } else {
          addPart(xmlElement, "text-theme-syntax-tag");
        }
      }

      currentIndex = match.index + match[0].length;
    }

    // Add any remaining text
    if (currentIndex < trimmedLine.length) {
      addPart(trimmedLine.substring(currentIndex), "text-theme-syntax-text");
    }

    return (
      <div key={index} className="leading-relaxed font-mono">
        {parts.length > 0 ? (
          parts
        ) : (
          <span className="text-theme-syntax-text">{trimmedLine}</span>
        )}
      </div>
    );
  });
}

export default function XMLViewer({
  isVisible,
  xmlContent,
  onClose,
}: XMLViewerProps) {
  const [width, setWidth] = useState(384); // Default width (w-96 = 384px)
  const [isResizing, setIsResizing] = useState(false);

  // Detect format and format/highlight accordingly
  const isJsonFormat = isJSON(xmlContent);
  const formattedContent = isJsonFormat
    ? formatJSON(xmlContent)
    : formatXML(xmlContent);
  const highlightedContent = isJsonFormat
    ? highlightJSON(formattedContent)
    : highlightXML(formattedContent);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formattedContent);
      // Could add notification here if needed
    } catch (err) {
      console.error("Failed to copy content:", err);
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
    if (!isResizing) return;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, handleMouseMove]);

  if (!isVisible) return null;

  return (
    <div
      className="bg-theme-modal-container-bg border-l border-theme-modal-container-border flex flex-col h-full relative"
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className="absolute left-0 top-0 w-1 h-full cursor-col-resize hover:bg-theme-interactive-accent transition-colors z-10"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      />

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-theme-modal-header-bg border-theme-modal-header-border">
        {/* Code icon */}
        <div className="flex-shrink-0">
          <svg
            className="w-5 h-5 text-theme-text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-semibold text-theme-modal-header-text">
            {isJsonFormat ? "JSON Viewer" : "XML Viewer"}
          </h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="px-3 py-1.5 bg-theme-modal-btn-primary-bg hover:bg-theme-modal-btn-primary-bg-hover text-theme-modal-btn-primary-text border border-theme-modal-btn-primary-border hover:border-theme-modal-btn-primary-border-hover rounded text-sm font-medium transition-colors"
            title={`Copy formatted ${isJsonFormat ? "JSON" : "XML"} to clipboard`}
          >
            Copy
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-theme-modal-btn-secondary-bg hover:bg-theme-modal-btn-secondary-bg-hover text-theme-modal-btn-secondary-text border border-theme-modal-btn-secondary-border hover:border-theme-modal-btn-secondary-border-hover rounded text-sm font-medium transition-colors"
            title={`Close ${isJsonFormat ? "JSON" : "XML"} viewer`}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Description below header */}
      <div className="px-4 py-3 bg-theme-modal-header-bg border-b border-theme-modal-header-border">
        <p className="text-sm text-theme-modal-header-text opacity-75">
          {isJsonFormat
            ? "Live JSON representation of the current workflow (v2.0 format)"
            : "Live XML representation of the current workflow"}
        </p>
      </div>

      {/* Content with syntax highlighting */}
      <div className="flex-1 overflow-auto p-4 bg-theme-modal-content-bg">
        <div className="bg-theme-surface-elevated p-4 rounded border font-mono text-xs leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
          {highlightedContent}
        </div>
      </div>
    </div>
  );
}
