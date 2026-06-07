'use client';

import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

const executionApiUrl = process.env.NEXT_PUBLIC_EXECUTE_API_URL ?? 'http://localhost:4000/api/execute';

const starterCode = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const value = 6;
const result = fibonacci(value);
console.log({ value, result });
result;`;

type ExecutionLog = { level: string; message: string };
type SerializedValue = { type: string; value: string };
type TimelineEvent = { step: number; line: number; event: string; variables: Record<string, SerializedValue> };
type ExecutionResponse = {
  ok: boolean;
  result?: SerializedValue;
  logs: ExecutionLog[];
  timeline: TimelineEvent[];
  instrumentation?: { hookCount: number };
  error?: string;
  durationMs: number;
  timedOut: boolean;
};

export default function CodeEditor() {
  const [code, setCode] = useState(starterCode);
  const [output, setOutput] = useState<ExecutionResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedSnapshotIndex, setSelectedSnapshotIndex] = useState<number | null>(null);
  const [editorTheme, setEditorTheme] = useState<'void' | 'ice'>('void');
  
  // Set a balanced default height for the bottom panel
  const [bottomHeight, setBottomHeight] = useState(200);
  const [isMaximized, setIsMaximized] = useState(false)
const [isCollapsed, setIsCollapsed] = useState(false)
  const [isSashDragging, setIsSashDragging] = useState(false);
  
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const theme = document.documentElement.getAttribute('data-theme');
      setEditorTheme(theme === 'light' ? 'ice' : 'void');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  const snapshots = output?.timeline ?? [];
  const selectedSnapshot = selectedSnapshotIndex === null ? null : snapshots[selectedSnapshotIndex] ?? null;
  const selectedVariables = selectedSnapshot ? Object.entries(selectedSnapshot.variables) : [];

  const options = useMemo(() => ({
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
  }), []);

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

    monaco.editor.defineTheme('ice', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: '', foreground: '1e1b4b' },
        { token: 'keyword', foreground: '4f46e5' },
        { token: 'number', foreground: '0891b2' },
        { token: 'string', foreground: '059669' },
        { token: 'comment', foreground: '94a3b8' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editorLineNumber.foreground': '#94a3b8',
        'editorLineNumber.activeForeground': '#4f46e5',
        'editorCursor.foreground': '#4f46e5',
        'editor.selectionBackground': '#c7d2fe99',
        'editor.lineHighlightBackground': '#dbeafe',
      },
    });
  };

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
  };

  const highlightLine = (line: number) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, [
      {
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: 'executionLine',
          glyphMarginClassName: 'executionGlyph',
        },
      },
    ]);
    editor.revealLineInCenter(line);
  };

  const selectSnapshot = (index: number) => {
    const snapshot = snapshots[index];
    if (!snapshot) return;
    setSelectedSnapshotIndex(index);
    highlightLine(snapshot.line);
  };

  const scrubToSnapshot = (event: ChangeEvent<HTMLInputElement>) => {
    selectSnapshot(Number(event.target.value));
  };

  // Safe window-bounded drag event runner
  const onSashMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSashDragging(true);

    dragStartY.current = e.clientY;
    dragStartHeight.current = bottomHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      requestAnimationFrame(() => {
        if (!containerRef.current) return;

        const deltaY = moveEvent.clientY - dragStartY.current;
        // Dragging UP decreases deltaY, which dynamically increases our panel height
        const newHeight = dragStartHeight.current - deltaY;

        // Keep the dragging action inside safe bounds of the container height
        const containerHeight = containerRef.current.getBoundingClientRect().height;
        const minHeight = 60;
        const maxHeight = containerHeight - 120; // Saves room for topbar/editor space

        if (newHeight >= minHeight && newHeight <= maxHeight) {
          setBottomHeight(newHeight);
        }
      });
    };

    const onMouseUp = () => {
      setIsSashDragging(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [bottomHeight]);

  const runCode = async () => {
    setIsRunning(true);
    setOutput(null);
    setSelectedSnapshotIndex(null);
    if (editorRef.current) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
    }
    try {
      const response = await fetch(executionApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, timeoutMs: 1000 }),
      });
      const result = (await response.json()) as ExecutionResponse;
      setOutput(result);
      if (result.timeline?.[0]) {
        setSelectedSnapshotIndex(0);
        highlightLine(result.timeline[0].line);
      }
    } catch (error) {
      setOutput({
        ok: false,
        logs: [],
        timeline: [],
        durationMs: 0,
        timedOut: false,
        error: error instanceof Error ? error.message : 'Unable to reach the execution sandbox.',
      });
    } finally {
      setIsRunning(false);
    }
  };

const maximizePanel = () => {
    if (containerRef.current) {
      // Snaps the height to the exact full boundary of the container
      const totalHeight = containerRef.current.getBoundingClientRect().height;
      setBottomHeight(totalHeight);
    } else {
      setBottomHeight(window.innerHeight - 120);
    }
    setIsMaximized(true);
    setIsCollapsed(false);
  };

  const collapsePanel = () => {
    setBottomHeight(38); // Down to a thin header bar line
    setIsCollapsed(true);
    setIsMaximized(false);
  };

  const resetPanel = () => {
    setBottomHeight(200); // Reverts cleanly to standard split view
    setIsMaximized(false);
    setIsCollapsed(false);
  };
  return (
    <div
      ref={containerRef}
      className="codeRunner"
      style={{
        display: 'grid',
        height: '100%',             // Takes up exactly 100% of its workspace column container
        maxHeight: 'calc(100vh - 120px)', // HARD-LOCKS container height so page doesn't grow longer
        minHeight: 0,
        gridTemplateRows: `auto 1fr 6px ${bottomHeight}px`, // 1fr on editor space steals directly from drag changes
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Global Mouse Event Overlay Shield */}
      {isSashDragging && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            cursor: 'ns-resize',
            backgroundColor: 'transparent',
            userSelect: 'none',
          }}
        />
      )}

      <div className="runnerToolbar">
        <button className="primaryAction" type="button" onClick={runCode} disabled={isRunning}>
          {isRunning ? 'Tracing…' : 'Trace Execution'}
        </button>
        <span>AST hooks · JavaScript VM · 1s timeout · isolated worker</span>
      </div>

      <div className="monacoPane" style={{ minHeight: 0, overflow: 'hidden', flex: 1 }}>
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={code}
          onChange={(value) => setCode(value ?? '')}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorMount}
          theme={editorTheme}
          options={options}
        />
      </div>

      {/* Draggable Sash Line element */}
      {/* Draggable Sash Line element */}
      <div
        className={`sash ${isSashDragging ? 'dragging' : ''}`}
        onMouseDown={isMaximized || isCollapsed ? undefined : onSashMouseDown}
        style={{
          height: '6px',
          cursor: isMaximized || isCollapsed ? 'not-allowed' : 'ns-resize',
          background: isSashDragging ? 'var(--accent-blue, #7c3aed)' : '#1e1e35',
          zIndex: 1000,
          position: 'relative',
          transition: 'background 0.15s ease',
        }}
      />

      <div 
        className={`outputPane ${output?.ok ? 'success' : output ? 'failure' : ''}`}
        style={{ minHeight: 0, overflow: 'auto', height: `${bottomHeight}px` }}
      >
        <div className="outputHeader" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Playback Engine</span>
            {output ? (
              <span style={{ opacity: 0.7, fontSize: '0.78rem' }}>
                {snapshots.length} snapshots · {output.instrumentation?.hookCount ?? 0} hooks · {output.durationMs}ms
              </span>
            ) : (
              <span style={{ opacity: 0.7, fontSize: '0.78rem' }}>Idle</span>
            )}
          </div>
          
          {/* Quick Actions Control Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {isMaximized || isCollapsed ? (
              <button 
                type="button" 
                onClick={resetPanel}
                title="Restore Normal Layout"
                style={{ background: 'transparent', border: '1px solid #1f2f50', color: '#9fb8ea', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}
              >
                🗗
              </button>
            ) : null}
            {!isCollapsed && (
              <button 
                type="button" 
                onClick={collapsePanel}
                title="Collapse Panel"
                style={{ background: 'transparent', border: '1px solid #1f2f50', color: '#9fb8ea', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}
              >
                ▼
              </button>
            )}
            {!isMaximized && (
              <button 
                type="button" 
                onClick={maximizePanel}
                title="Maximize Panel"
                style={{ background: 'transparent', border: '1px solid #1f2f50', color: '#9fb8ea', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}
              >
                ▲
              </button>
            )}
          </div>
        </div>

        {/* Prevent content from overflowing when collapsed */}
        {!isCollapsed && (
          <div className="outputBody">
            {output ? (
              <>
                {output.error ? <pre className="errorText">{output.error}</pre> : null}
                {output.result ? <pre>Result ({output.result.type}): {output.result.value}</pre> : null}
                {snapshots.length ? (
                  <>
                    <section className="scrubberPanel" aria-label="Execution playback scrubber">
                      <div className="scrubberMeta">
                        <strong>
                          Snapshot {selectedSnapshotIndex === null ? 0 : selectedSnapshotIndex + 1} of {snapshots.length}
                        </strong>
                        {selectedSnapshot ? (
                          <span>step #{selectedSnapshot.step} · line {selectedSnapshot.line} · {selectedSnapshot.event}</span>
                        ) : null}
                      </div>
                      <input
                        aria-label="Scrub execution snapshots"
                        className="snapshotScrubber"
                        type="range"
                        min="0"
                        max={snapshots.length - 1}
                        step="1"
                        value={selectedSnapshotIndex ?? 0}
                        onChange={scrubToSnapshot}
                      />
                    </section>

                    <section className="inspectorPanel" aria-label="Variable Inspector">
                      <div className="inspectorHeader">
                        <h3>Variable Inspector</h3>
                        {selectedSnapshot ? <span>Active line {selectedSnapshot.line}</span> : null}
                      </div>
                      <table className="variableTable">
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Type</th>
                            <th scope="col">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedVariables.length ? (
                            selectedVariables.map(([name, value]) => (
                              <tr key={`${selectedSnapshot?.step}-${name}`}>
                                <th scope="row">{name}</th>
                                <td>{value.type}</td>
                                <td><code>{value.value}</code></td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={3} className="emptyInspector">No variables changed in this snapshot.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </section>

                    <ol className="timelineList" aria-label="Execution trace snapshots">
                      {snapshots.map((snapshot, index) => (
                        <li key={snapshot.step}>
                          <button
                            className={selectedSnapshotIndex === index ? 'timelineStep active' : 'timelineStep'}
                            type="button"
                            onClick={() => selectSnapshot(index)}
                          >
                            <span className="stepMeta">#{snapshot.step} · line {snapshot.line} · {snapshot.event}</span>
                          </button>
                        </li>
                      ))}
                    </ol>
                  </>
                ) : null}
                {output.logs.length ? (
                  <div className="logList">
                    {output.logs.map((log, index) => (
                      <pre key={`${log.level}-${index}`}>[{log.level}] {log.message}</pre>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p style={{ padding: '0.5rem', margin: 0 }}>Run code to see variable snapshots, loop checkpoints, console output, errors, and timeout status.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}