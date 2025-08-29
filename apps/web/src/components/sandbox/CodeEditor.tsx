import React, { useEffect, useRef, useState } from 'react';
import * as monaco from 'monaco-editor';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  height?: string;
  width?: string;
  className?: string;
  onSave?: (value: string) => void;
  onRun?: (value: string) => void;
  showLineNumbers?: boolean;
  wordWrap?: boolean;
  fontSize?: number;
  minimap?: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'python',
  theme = 'light',
  readOnly = false,
  height = '400px',
  width = '100%',
  className = '',
  onSave,
  onRun,
  showLineNumbers = true,
  wordWrap = true,
  fontSize = 14,
  minimap = false
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  useEffect(() => {
    if (editorRef.current && !monacoRef.current) {
      // Initialize Monaco Editor
      const editor = monaco.editor.create(editorRef.current, {
        value,
        language,
        theme: theme === 'dark' ? 'vs-dark' : 'vs',
        readOnly,
        lineNumbers: showLineNumbers ? 'on' : 'off',
        wordWrap: wordWrap ? 'on' : 'off',
        fontSize,
        minimap: { enabled: minimap },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        renderLineHighlight: 'line',
        selectOnLineNumbers: true,
        roundedSelection: false,
        cursorStyle: 'line',
        cursorWidth: 2,
        tabSize: 4,
        insertSpaces: true,
        renderWhitespace: 'boundary',
        renderControlCharacters: true,
        contextmenu: true,
        mouseWheelZoom: true,
      });

      // Set up change listener
      editor.onDidChangeModelContent(() => {
        const currentValue = editor.getValue();
        onChange(currentValue);
      });

      // Set up keyboard shortcuts
      if (onSave) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
          onSave(editor.getValue());
        });
      }

      if (onRun) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
          onRun(editor.getValue());
        });
        
        editor.addCommand(monaco.KeyCode.F5, () => {
          onRun(editor.getValue());
        });
      }

      monacoRef.current = editor;
      setIsEditorReady(true);
    }

    return () => {
      if (monacoRef.current) {
        monacoRef.current.dispose();
        monacoRef.current = null;
      }
    };
  }, []);

  // Update editor value when prop changes
  useEffect(() => {
    if (monacoRef.current && isEditorReady) {
      const currentValue = monacoRef.current.getValue();
      if (currentValue !== value) {
        monacoRef.current.setValue(value);
      }
    }
  }, [value, isEditorReady]);

  // Update editor theme
  useEffect(() => {
    if (monacoRef.current && isEditorReady) {
      monaco.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs');
    }
  }, [theme, isEditorReady]);

  // Update editor language
  useEffect(() => {
    if (monacoRef.current && isEditorReady) {
      const model = monacoRef.current.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, language);
      }
    }
  }, [language, isEditorReady]);

  // Update read-only state
  useEffect(() => {
    if (monacoRef.current && isEditorReady) {
      monacoRef.current.updateOptions({ readOnly });
    }
  }, [readOnly, isEditorReady]);

  // Methods for external control
  const insertText = (text: string, position?: monaco.Position) => {
    if (monacoRef.current) {
      const selection = monacoRef.current.getSelection();
      const range = position ? 
        new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column) :
        selection || new monaco.Range(1, 1, 1, 1);

      const operation = { range, text, forceMoveMarkers: true };
      monacoRef.current.executeEdits('insert-text', [operation]);
      monacoRef.current.focus();
    }
  };

  const formatCode = () => {
    if (monacoRef.current) {
      monacoRef.current.getAction('editor.action.formatDocument')?.run();
    }
  };

  const addBreakpoint = (lineNumber: number) => {
    if (monacoRef.current) {
      const model = monacoRef.current.getModel();
      if (model) {
        const decorations = monacoRef.current.deltaDecorations([], [
          {
            range: new monaco.Range(lineNumber, 1, lineNumber, 1),
            options: {
              isWholeLine: true,
              className: 'breakpoint-line',
              glyphMarginClassName: 'breakpoint-glyph',
            },
          },
        ]);
        return decorations;
      }
    }
    return [];
  };

  const highlightLine = (lineNumber: number, className = 'highlight-line') => {
    if (monacoRef.current) {
      const decorations = monacoRef.current.deltaDecorations([], [
        {
          range: new monaco.Range(lineNumber, 1, lineNumber, 1),
          options: {
            isWholeLine: true,
            className,
          },
        },
      ]);
      return decorations;
    }
    return [];
  };

  const clearDecorations = (decorationIds: string[]) => {
    if (monacoRef.current) {
      monacoRef.current.deltaDecorations(decorationIds, []);
    }
  };

  const goToLine = (lineNumber: number) => {
    if (monacoRef.current) {
      monacoRef.current.revealLineInCenter(lineNumber);
      monacoRef.current.setPosition({ lineNumber, column: 1 });
    }
  };

  const getSelectionText = (): string => {
    if (monacoRef.current) {
      const selection = monacoRef.current.getSelection();
      if (selection) {
        const model = monacoRef.current.getModel();
        return model ? model.getValueInRange(selection) : '';
      }
    }
    return '';
  };

  // Expose methods via ref
  React.useImperativeHandle(ref, () => ({
    insertText,
    formatCode,
    addBreakpoint,
    highlightLine,
    clearDecorations,
    goToLine,
    getSelectionText,
    getValue: () => monacoRef.current?.getValue() || '',
    focus: () => monacoRef.current?.focus(),
  }));

  return (
    <div className={`code-editor ${className}`}>
      <div className="editor-toolbar">
        <div className="editor-actions">
          {onRun && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => onRun(monacoRef.current?.getValue() || '')}
              title="Run (Ctrl+Enter or F5)"
            >
              ▶️ Run
            </button>
          )}
          {onSave && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onSave(monacoRef.current?.getValue() || '')}
              title="Save (Ctrl+S)"
            >
              💾 Save
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={formatCode}
            title="Format Code"
          >
            🎨 Format
          </button>
        </div>
        
        <div className="editor-info">
          <span className="language-indicator">
            {language.toUpperCase()}
          </span>
          {readOnly && (
            <span className="readonly-indicator">
              🔒 Read Only
            </span>
          )}
        </div>
      </div>

      <div
        ref={editorRef}
        className="editor-container"
        style={{ height, width }}
      />

      <style jsx>{`
        .code-editor {
          border: 1px solid #d1d5db;
          border-radius: 8px;
          overflow: hidden;
          background: white;
        }

        .code-editor.dark {
          background: #1e1e1e;
          border-color: #404040;
        }

        .editor-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f9fafb;
          border-bottom: 1px solid #d1d5db;
          font-size: 12px;
        }

        .dark .editor-toolbar {
          background: #252526;
          border-bottom-color: #404040;
          color: #cccccc;
        }

        .editor-actions {
          display: flex;
          gap: 8px;
        }

        .editor-info {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .btn {
          padding: 4px 8px;
          border: 1px solid transparent;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:hover {
          opacity: 0.8;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
          border-color: #2563eb;
        }

        .btn-secondary {
          background: #6b7280;
          color: white;
          border-color: #4b5563;
        }

        .language-indicator {
          font-weight: 600;
          color: #6b7280;
        }

        .readonly-indicator {
          color: #ef4444;
          font-weight: 500;
        }

        .editor-container {
          position: relative;
        }

        :global(.breakpoint-line) {
          background-color: rgba(255, 0, 0, 0.1) !important;
        }

        :global(.breakpoint-glyph) {
          background-color: #ff0000 !important;
          border-radius: 50%;
          width: 12px !important;
          height: 12px !important;
          margin-left: 4px !important;
        }

        :global(.highlight-line) {
          background-color: rgba(255, 255, 0, 0.2) !important;
        }

        :global(.error-line) {
          background-color: rgba(255, 0, 0, 0.1) !important;
          border-left: 3px solid #ef4444 !important;
        }

        :global(.warning-line) {
          background-color: rgba(255, 165, 0, 0.1) !important;
          border-left: 3px solid #f59e0b !important;
        }
      `}</style>
    </div>
  );
};

// Forward ref to access methods
const ref = React.forwardRef<any, CodeEditorProps>((props, forwardedRef) => {
  return <CodeEditor {...props} ref={forwardedRef} />;
});

ref.displayName = 'CodeEditor';

export default ref;