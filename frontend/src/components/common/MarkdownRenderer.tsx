/**
 * MarkdownRenderer Component
 * 
 * Reusable markdown renderer with syntax highlighting for code blocks.
 * Integrates react-markdown with custom renderers for code blocks.
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import CodeBlock from './CodeBlock';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  fallbackText?: string;
}

/**
 * Renders markdown content with syntax-highlighted code blocks
 */
const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  className = '',
  fallbackText = 'No content provided.',
}) => {
  return (
    <div
      className={`prose prose-sm max-w-none prose-headings:text-theme-text-primary prose-p:text-theme-text-primary prose-li:text-theme-text-primary prose-strong:text-theme-text-primary prose-code:text-theme-text-primary prose-code:bg-theme-surface-panel prose-code:px-1 prose-code:rounded prose-a:text-theme-border-focus prose-a:no-underline hover:prose-a:underline ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const codeString = String(children).replace(/\n$/, '');
            const isInline = !className && !codeString.includes('\n');
            
            // Inline code - use default styling
            if (isInline) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            
            // Block code with language - use syntax highlighter
            if (match) {
              const language = match[1] as 'json' | 'python' | 'javascript' | 'typescript' | 'markdown' | 'yaml' | 'sql';
              return <CodeBlock code={codeString} language={language} />;
            }
            
            // Block code without language - plain code block
            return (
              <pre className="bg-theme-surface-panel p-4 rounded-md overflow-x-auto">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
        }}
      >
        {content || fallbackText}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
