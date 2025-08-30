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

// Forward ref to access methods
const CodeEditor = React.forwardRef<monaco.editor.IStandaloneCodeEditor | null, CodeEditorProps>((props, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Expose editor instance to parent through ref
  React.useImperativeHandle(ref, () => monacoRef.current, []);

  useEffect(() => {
    if (editorRef.current && !monacoRef.current) {
      // Initialize Monaco Editor
      const editor = monaco.editor.create(editorRef.current, {
        value: props.value,
        language: props.language || 'python',
        theme: (props.theme || 'light') === 'dark' ? 'vs-dark' : 'vs',
        readOnly: props.readOnly || false,
        lineNumbers: (props.showLineNumbers ?? true) ? 'on' : 'off',
        wordWrap: (props.wordWrap ?? true) ? 'on' : 'off',
        fontSize: props.fontSize || 14,
        minimap: { enabled: props.minimap || false },
        automaticLayout: true,
        scrollBeyondLastLine: false,
        renderWhitespace: 'selection',
        formatOnPaste: true,
        formatOnType: true,
      });

      monacoRef.current = editor;
      setIsEditorReady(true);

      // Handle value changes
      editor.onDidChangeModelContent(() => {
        const currentValue = editor.getValue();
        if (currentValue !== props.value) {
          props.onChange(currentValue);
        }
      });

      // Handle keyboard shortcuts
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        if (props.onSave) {
          props.onSave(editor.getValue());
        }
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        if (props.onRun) {
          props.onRun(editor.getValue());
        }
      });
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
      const editor = monacoRef.current;
      const currentValue = editor.getValue();
      if (currentValue !== props.value) {
        editor.setValue(props.value);
      }
    }
  }, [props.value, isEditorReady]);

  // Update editor options when props change
  useEffect(() => {
    if (monacoRef.current && isEditorReady) {
      const editor = monacoRef.current;
      editor.updateOptions({
        theme: (props.theme || 'light') === 'dark' ? 'vs-dark' : 'vs',
        readOnly: props.readOnly || false,
        lineNumbers: (props.showLineNumbers ?? true) ? 'on' : 'off',
        wordWrap: (props.wordWrap ?? true) ? 'on' : 'off',
        fontSize: props.fontSize || 14,
        minimap: { enabled: props.minimap || false },
      });
    }
  }, [props.theme, props.readOnly, props.showLineNumbers, props.wordWrap, props.fontSize, props.minimap, isEditorReady]);

  // Update language when prop changes
  useEffect(() => {
    if (monacoRef.current && isEditorReady && props.language) {
      const editor = monacoRef.current;
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelLanguage(model, props.language);
      }
    }
  }, [props.language, isEditorReady]);

  return (
    <div className={`monaco-editor-container ${props.className || ''}`}>
      <div
        ref={editorRef}
        style={{
          height: props.height || '400px',
          width: props.width || '100%',
        }}
      />
      <style>{`
        .monaco-editor-container {
          border: 1px solid #e1e5e9;
          border-radius: 4px;
          overflow: hidden;
        }
        .monaco-editor-container .monaco-editor {
          height: 100% !important;
        }
      `}</style>
    </div>
  );
});

CodeEditor.displayName = 'CodeEditor';

export default CodeEditor;