import { Editor, OnMount } from '@monaco-editor/react';
import { editor } from 'monaco-editor';
import { useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  readOnly?: boolean;
  height?: string;
  theme?: string;
  placeholder?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'python',
  readOnly = false,
  height = '200px',
  theme,
  placeholder,
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
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
  };

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
