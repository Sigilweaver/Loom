/**
 * CodeBlock Component
 * 
 * Wrapper around react-syntax-highlighter that integrates with the theme system.
 * Provides syntax highlighting for code blocks in various languages.
 */

import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';

interface CodeBlockProps {
  code: string;
  language: 'json' | 'python' | 'javascript' | 'typescript' | 'markdown' | 'yaml' | 'sql';
  showLineNumbers?: boolean;
  className?: string;
}

/**
 * Custom Prism theme that uses CSS variables from our theme system
 */
const customTheme = {
  'code[class*="language-"]': {
    color: 'var(--color-syntax-text)',
    background: 'transparent',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: '0.875rem',
    lineHeight: '1.5',
  },
  'pre[class*="language-"]': {
    background: 'var(--color-syntax-background)',
    padding: '1rem',
    margin: 0,
    overflow: 'auto',
    borderRadius: '0.375rem',
  },
  'comment': {
    color: 'var(--color-syntax-comment)',
    fontStyle: 'italic',
  },
  'prolog': {
    color: 'var(--color-syntax-comment)',
  },
  'doctype': {
    color: 'var(--color-syntax-comment)',
  },
  'cdata': {
    color: 'var(--color-syntax-comment)',
  },
  'punctuation': {
    color: 'var(--color-syntax-tag)',
  },
  'property': {
    color: 'var(--color-syntax-attribute)',
  },
  'tag': {
    color: 'var(--color-syntax-tag)',
  },
  'boolean': {
    color: 'var(--color-syntax-keyword)',
  },
  'number': {
    color: 'var(--color-syntax-number)',
  },
  'constant': {
    color: 'var(--color-syntax-number)',
  },
  'symbol': {
    color: 'var(--color-syntax-number)',
  },
  'deleted': {
    color: 'var(--color-syntax-error)',
  },
  'selector': {
    color: 'var(--color-syntax-tag)',
  },
  'attr-name': {
    color: 'var(--color-syntax-attribute)',
  },
  'string': {
    color: 'var(--color-syntax-value)',
  },
  'char': {
    color: 'var(--color-syntax-value)',
  },
  'builtin': {
    color: 'var(--color-syntax-keyword)',
  },
  'inserted': {
    color: 'var(--color-syntax-value)',
  },
  'operator': {
    color: 'var(--color-syntax-text)',
  },
  'entity': {
    color: 'var(--color-syntax-attribute)',
  },
  'url': {
    color: 'var(--color-syntax-value)',
  },
  'variable': {
    color: 'var(--color-syntax-text)',
  },
  'atrule': {
    color: 'var(--color-syntax-keyword)',
  },
  'attr-value': {
    color: 'var(--color-syntax-value)',
  },
  'function': {
    color: 'var(--color-syntax-function)',
  },
  'class-name': {
    color: 'var(--color-syntax-declaration)',
  },
  'keyword': {
    color: 'var(--color-syntax-keyword)',
    fontWeight: 600,
  },
  'regex': {
    color: 'var(--color-syntax-value)',
  },
  'important': {
    color: 'var(--color-syntax-keyword)',
    fontWeight: 600,
  },
};

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  showLineNumbers = false,
  className = '',
}) => {
  return (
    <div className={className}>
      <SyntaxHighlighter
        language={language}
        style={customTheme}
        showLineNumbers={showLineNumbers}
        wrapLines={true}
        lineNumberStyle={{
          minWidth: '3em',
          paddingRight: '1em',
          color: 'var(--color-syntax-comment)',
          opacity: 0.6,
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

export default CodeBlock;
