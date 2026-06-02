'use client';

import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { useMemo, useRef, useState } from 'react';

const starterCode = `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const value = 6; 
const result = fibonacci(value); 
console.log({ value, result });`;

export default function CodeEditor() {
  const [code, setCode] = useState(starterCode);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  const options = useMemo(
    () => ({
      automaticLayout: true,
      fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 14,
      lineHeight: 22,
      minimap: { enabled: false },
      glyphMargin: true,
      lineNumbers: 'on' as const,
      smoothScrolling: true,
      scrollBeyondLastLine: false,
      tabSize: 2,
      padding: { top: 16, bottom: 16 },
    }),
    [] 
  );

  const handleEditorWillMount = (monaco: Monaco) => {
    monaco.editor.defineTheme('void', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'D7E4F8' },
        { token: 'keyword', foreground: '88B4FF' },
        { token: 'number', foreground: 'F4CA64' },
        { token: 'string', foreground: '95D8A6' },
        { token: 'comment', foreground: '6A7D9B' },
      ],
      colors: {
        'editor.background': '#0B1020',
        'editorLineNumber.foreground': '#425176',
        'editorLineNumber.activeForeground': '#8FB5FF',
        'editorCursor.foreground': '#7AB8FF',
        'editor.selectionBackground': '#1B325C99',
        'editor.lineHighlightBackground': '#111A2D',
      },
    });

      // Light theme
    monaco.editor.defineTheme('void-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: '1E2A3A' },
        { token: 'keyword', foreground: '2255CC' },
        { token: 'number', foreground: 'B5520A' },
        { token: 'string', foreground: '1A7A3A' },
        { token: 'comment', foreground: '6A7D9B' },
      ],
      colors: {
        'editor.background': '#F0F4FF',
        'editorLineNumber.foreground': '#8899BB',
        'editorLineNumber.activeForeground': '#2255CC',
        'editorCursor.foreground': '#2255CC',
        'editor.selectionBackground': '#BDD4FF99',
        'editor.lineHighlightBackground': '#E4ECFF',
      },
    }); 
  };

  const handleEditorMount: OnMount = (editor) => {
  editorRef.current = editor; 
}; 

  return (
    <Editor
      height="100%"
      defaultLanguage="typescript"
      value={code}
      onChange={(value) => setCode(value ?? '')}
      beforeMount={handleEditorWillMount}
      onMount={handleEditorMount} 
      theme="void"
      options={options}
    />
  );
} 
