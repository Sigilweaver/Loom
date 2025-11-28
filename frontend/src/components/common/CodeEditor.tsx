import { Editor, OnMount } from '@monaco-editor/react';
import { editor, languages, Position, IRange } from 'monaco-editor';
import type * as Monaco from 'monaco-editor';
import { useRef, useEffect, useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import type { ColumnSchema, PolarsFunctionsResponse } from '../../api/backend';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
  theme?: string;
  placeholder?: string;
  columns?: ColumnSchema[];
  polarsFunctions?: PolarsFunctionsResponse | null;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'python',
  readOnly = false,
  height = '200px',
  theme,
  placeholder,
  columns = [],
  polarsFunctions = null,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const completionDisposableRef = useRef<Monaco.IDisposable | null>(null);
  const [monacoReady, setMonacoReady] = useState(false);
  const { currentTheme } = useTheme();

  // Map app themes to Monaco themes
  const getMonacoTheme = () => {
    if (theme) return theme; // Allow override
    
    switch (currentTheme.id) {
      case 'light':
      case 'high-contrast':
        return 'vs'; // Light theme
      case 'sigilweaver':
      case 'dark':
      default:
        return 'vs-dark'; // Dark theme
    }
  };

  const monacoTheme = getMonacoTheme();

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setMonacoReady(true); // Trigger useEffect

    // Define custom theme colors for dark themes to match app background
    if (monacoTheme === 'vs-dark') {
      const bgColor = currentTheme.colors.surfaces.elevated;
      const textColor = currentTheme.colors.text.primary;
      const lineNumberColor = currentTheme.colors.text.tertiary;
      const selectionBg = currentTheme.colors.borders.focus + '33'; // 20% opacity
      
      monaco.editor.defineTheme('sigilweaver-dark', {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': bgColor,
          'editor.foreground': textColor,
          'editorLineNumber.foreground': lineNumberColor,
          'editorLineNumber.activeForeground': lineNumberColor,
          'editor.lineHighlightBackground': bgColor,
          'editor.selectionBackground': selectionBg,
          'editorCursor.foreground': textColor,
        },
      });
      
      monaco.editor.setTheme('sigilweaver-dark');
    }

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: false },
      fontSize: 13,
      lineNumbers: 'on',
      roundedSelection: true,
      scrollBeyondLastLine: false,
      readOnly,
      automaticLayout: true,
      padding: { top: 8, bottom: 8 },
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        useShadows: false,
      },
      wordWrap: 'on',
      lineDecorationsWidth: 10,
      lineNumbersMinChars: 3,
      glyphMargin: false,
      folding: false,
    });

    // Show placeholder if empty
    if (!value && placeholder) {
      const decorations = editor.createDecorationsCollection([
        {
          range: new monaco.Range(1, 1, 1, 1),
          options: {
            after: {
              content: placeholder,
              inlineClassName: 'monaco-placeholder',
            },
          },
        },
      ]);

      // Clear placeholder when user types
      editor.onDidChangeModelContent(() => {
        const currentValue = editor.getValue();
        if (currentValue) {
          decorations.clear();
        }
      });
    }

    // Autocomplete registration is handled in useEffect below
  };

  // Re-register completion provider when columns or functions change
  useEffect(() => {
    const monaco = monacoRef.current;
    if (!monaco || language !== 'python' || !monacoReady) {
      return;
    }

    // Dispose previous completion provider
    if (completionDisposableRef.current) {
      completionDisposableRef.current.dispose();
      completionDisposableRef.current = null;
    }

    // Only register if we have columns
    if (columns.length === 0) {
      return;
    }

    const disposable = monaco.languages.registerCompletionItemProvider('python', {
      triggerCharacters: ['.', '(', "'", '"', '=', '>', '<', '&', '|'],
      provideCompletionItems: (model: Monaco.editor.ITextModel, position: Position) => {
        
        const suggestions: languages.CompletionItem[] = [];
        const word = model.getWordUntilPosition(position);
        const lineContent = model.getLineContent(position.lineNumber);
        const textBeforeCursor = lineContent.substring(0, position.column - 1);
        
        // Default range: replace the current word
        const defaultRange: IRange = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        // Helper: Get column type from pl.col('name')
        const getColumnType = (colName: string): string | null => {
          const col = columns.find(c => c.name === colName);
          return col?.dtype || null;
        };

        // Helper: Check if dtype is string
        const isStringType = (dtype: string | null): boolean => {
          return dtype === 'String' || dtype === 'Utf8';
        };

        // Helper: Check if dtype is numeric
        const isNumericType = (dtype: string | null): boolean => {
          return !!dtype && /^(Int|UInt|Float)\d+$/.test(dtype);
        };

        // Helper: Check if dtype is datetime
        const isDatetimeType = (dtype: string | null): boolean => {
          return dtype === 'Date' || dtype === 'Datetime';
        };

        // Context 1: User typed "pl." - suggest Polars functions
        if (/\bpl\.[\w]*$/.test(textBeforeCursor)) {
          if (polarsFunctions?.table_level) {
            polarsFunctions.table_level.forEach(fn => {
              const cleanName = fn.name.replace('pl.', '');
              suggestions.push({
                label: cleanName,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: fn.snippet.replace('pl.', ''),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: fn.description,
                detail: fn.signature,
                range: defaultRange,
              });
            });
          } else {
            // Fallback if functions not loaded
            suggestions.push(
              {
                label: 'col',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: `col('\${1}')`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Reference a column by name',
                detail: 'pl.col(name: str)',
                range: defaultRange,
              },
              {
                label: 'lit',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: `lit(\${1})`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Create a literal value',
                detail: 'pl.lit(value)',
                range: defaultRange,
              },
              {
                label: 'when',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: `when(\${1}).then(\${2}).otherwise(\${3})`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Conditional expression (if-then-else)',
                detail: 'pl.when(condition).then(value).otherwise(value)',
                range: defaultRange,
              }
            );
          }
        }
        // Context 2: Inside pl.col('...') - suggest column names
        else if (/pl\.col\(['"]/.test(textBeforeCursor) && !/pl\.col\(['"]\w+['"]\)/.test(textBeforeCursor)) {
          columns.forEach(col => {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: col.name,
              documentation: `${col.dtype}${col.nullable ? ' (nullable)' : ''}`,
              detail: `Column: ${col.dtype}`,
              range: defaultRange,
            });
          });
        }
        // Context 3: After pl.col('name'). - suggest column methods
        else if (/pl\.col\(['"]\w+['"]\)\.$/.test(textBeforeCursor) && polarsFunctions) {
          // Extract column name to determine type
          const colMatch = textBeforeCursor.match(/pl\.col\(['"](\w+)['"]\)/);
          const colName = colMatch ? colMatch[1] : null;
          const colType = colName ? getColumnType(colName) : null;

          // Add methods for all columns
          if (polarsFunctions.column_methods?.all) {
            polarsFunctions.column_methods.all.forEach(method => {
              const cleanName = method.name.startsWith('.') ? method.name.substring(1) : method.name;
              suggestions.push({
                label: cleanName,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: method.snippet.substring(1), // Remove leading dot
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: method.description,
                detail: method.signature,
                range: defaultRange,
                sortText: `0_${cleanName}`,
              });
            });
          }

          // Add string methods if column is string type
          if (isStringType(colType) && polarsFunctions.column_methods?.string) {
            polarsFunctions.column_methods.string.forEach(method => {
              const cleanName = method.name.startsWith('.') ? method.name.substring(1) : method.name;
              suggestions.push({
                label: cleanName,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: method.snippet.substring(1),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: method.description,
                detail: method.signature,
                range: defaultRange,
                sortText: `1_${cleanName}`,
              });
            });
          }

          // Add numeric methods if column is numeric type
          if (isNumericType(colType) && polarsFunctions.column_methods?.numeric) {
            polarsFunctions.column_methods.numeric.forEach(method => {
              const cleanName = method.name.startsWith('.') ? method.name.substring(1) : method.name;
              suggestions.push({
                label: cleanName,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: method.snippet.substring(1),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: method.description,
                detail: method.signature,
                range: defaultRange,
                sortText: `1_${cleanName}`,
              });
            });
          }

          // Add datetime methods if column is datetime type
          if (isDatetimeType(colType) && polarsFunctions.column_methods?.datetime) {
            polarsFunctions.column_methods.datetime.forEach(method => {
              const cleanName = method.name.startsWith('.') ? method.name.substring(1) : method.name;
              suggestions.push({
                label: cleanName,
                kind: monaco.languages.CompletionItemKind.Method,
                insertText: method.snippet.substring(1),
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: method.description,
                detail: method.signature,
                range: defaultRange,
                sortText: `1_${cleanName}`,
              });
            });
          }
        }
        // Context 4: Operators - suggest comparison/logical operators
        else if (/\)\s*$/.test(textBeforeCursor) || /['"]\s*$/.test(textBeforeCursor)) {
          // After closing paren or quote, suggest operators
          const operators = [
            { label: '==', insertText: ' == ', detail: 'Equal to' },
            { label: '!=', insertText: ' != ', detail: 'Not equal to' },
            { label: '>', insertText: ' > ', detail: 'Greater than' },
            { label: '<', insertText: ' < ', detail: 'Less than' },
            { label: '>=', insertText: ' >= ', detail: 'Greater than or equal' },
            { label: '<=', insertText: ' <= ', detail: 'Less than or equal' },
            { label: '&', insertText: ' & ', detail: 'Logical AND' },
            { label: '|', insertText: ' | ', detail: 'Logical OR' },
            { label: '+', insertText: ' + ', detail: 'Addition' },
            { label: '-', insertText: ' - ', detail: 'Subtraction' },
            { label: '*', insertText: ' * ', detail: 'Multiplication' },
            { label: '/', insertText: ' / ', detail: 'Division' },
          ];

          operators.forEach(op => {
            suggestions.push({
              label: op.label,
              kind: monaco.languages.CompletionItemKind.Operator,
              insertText: op.insertText,
              documentation: op.detail,
              detail: op.detail,
              range: defaultRange,
              sortText: `2_${op.label}`,
            });
          });
        }
        // Context 5: General - show both columns (as pl.col(...)) and functions
        else {
          // Add column suggestions wrapped in pl.col()
          columns.forEach(col => {
            suggestions.push({
              label: col.name,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: `pl.col('${col.name}')`,
              documentation: `Column: ${col.dtype}${col.nullable ? ' (nullable)' : ''}`,
              detail: col.dtype,
              range: defaultRange,
              sortText: `0_${col.name}`, // Sort columns first
            });
          });
          
          // Add Polars functions
          if (polarsFunctions?.table_level) {
            polarsFunctions.table_level.forEach(fn => {
              suggestions.push({
                label: fn.name,
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: fn.snippet,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: fn.description,
                detail: fn.signature,
                range: defaultRange,
                sortText: `1_${fn.name}`,
              });
            });
          } else {
            // Fallback
            suggestions.push(
              {
                label: 'pl.col',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: `pl.col('\${1}')`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Reference a column by name',
                detail: 'pl.col(name: str)',
                range: defaultRange,
                sortText: '1_col',
              },
              {
                label: 'pl.lit',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: `pl.lit(\${1})`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Create a literal value',
                detail: 'pl.lit(value)',
                range: defaultRange,
                sortText: '1_lit',
              },
              {
                label: 'pl.when',
                kind: monaco.languages.CompletionItemKind.Function,
                insertText: `pl.when(\${1}).then(\${2}).otherwise(\${3})`,
                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: 'Conditional expression (if-then-else)',
                detail: 'pl.when(condition).then(value).otherwise(value)',
                range: defaultRange,
                sortText: '1_when',
              }
            );
          }
        }

        return { suggestions };
      },
    });

    completionDisposableRef.current = disposable;

    // Cleanup when columns change or component unmounts
    return () => {
      if (completionDisposableRef.current) {
        completionDisposableRef.current.dispose();
        completionDisposableRef.current = null;
      }
    };
  }, [columns, language, monacoReady, polarsFunctions]);

  return (
    <div className="monaco-editor-wrapper">
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(value) => onChange(value || '')}
        onMount={handleEditorDidMount}
        theme={monacoTheme}
        options={{
          readOnly,
        }}
      />
    </div>
  );
};
