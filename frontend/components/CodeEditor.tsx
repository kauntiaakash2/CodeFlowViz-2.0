'use client';

import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayback } from '@/context/PlaybackContext';

type DockPosition = 'bottom' | 'right';

function parseJsonValue(rawValue: string): { parsed: unknown; isJson: boolean } {
  if (!rawValue) return { parsed: rawValue, isJson: false };
  try {
    const firstParse = JSON.parse(rawValue);
    if (firstParse !== null && typeof firstParse === 'object') {
      return { parsed: firstParse, isJson: true };
    }
    if (typeof firstParse === 'string') {
      try {
        const secondParse = JSON.parse(firstParse);
        if (secondParse !== null && typeof secondParse === 'object') {
          return { parsed: secondParse, isJson: true };
        }
      } catch {
        // Not a double-encoded JSON string
      }
    }
    return { parsed: firstParse, isJson: false };
  } catch {
    return { parsed: rawValue, isJson: false };
  }
}

const INITIAL_VISIBLE_COUNT = 50;

function JsonTreeNode({ keyName, value, depth = 0 }: { keyName?: string; value: unknown; depth?: number }) {
  const isObject = value !== null && typeof value === 'object';
  const isArray = Array.isArray(value);
  const entries = useMemo(() => {
    if (!isObject) return [];
    return isArray
      ? (value as unknown[]).map((item, idx) => [String(idx), item] as [string, unknown])
      : Object.entries(value as Record<string, unknown>);
  }, [isObject, isArray, value]);

  const count = entries.length;
  const [isExpanded, setIsExpanded] = useState(() => depth < 2 && (!isArray || count <= INITIAL_VISIBLE_COUNT));
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  if (isObject) {
    const typeLabel = isArray ? `Array[${count}]` : `Object {${count}}`;
    const visibleEntries = entries.slice(0, visibleCount);
    const hasMore = count > visibleCount;

    return (
      <div className="jsonTreeNode" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', lineHeight: '1.4' }}>
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={`${keyName ? `${keyName}: ` : ''}${typeLabel}`}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          style={{
            background: 'transparent',
            border: 'none',
            padding: 0,
            font: 'inherit',
            color: 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            userSelect: 'none',
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '0.65rem', width: '10px', display: 'inline-block', opacity: 0.8 }}>
            {isExpanded ? '▼' : '▶'}
          </span>
          {keyName !== undefined && (
            <span style={{ fontWeight: 600, color: 'var(--accent-cyan, #06b6d4)' }}>
              {keyName}:{' '}
            </span>
          )}
          <span style={{ opacity: 0.75, fontStyle: 'italic', fontSize: '0.78rem' }}>
            {typeLabel}
          </span>
        </button>
        {isExpanded && (
          <div style={{ paddingLeft: '12px', borderLeft: '1px dashed var(--border-color, #1e1e35)', marginLeft: '4px', marginTop: '2px' }}>
            {count === 0 ? (
              <span style={{ opacity: 0.5, fontStyle: 'italic', fontSize: '0.78rem' }}>empty</span>
            ) : (
              <>
                {visibleEntries.map(([childKey, childVal]) => (
                  <JsonTreeNode key={childKey} keyName={childKey} value={childVal} depth={depth + 1} />
                ))}
                {hasMore && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setVisibleCount((prev) => prev + INITIAL_VISIBLE_COUNT);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-cyan, #06b6d4)',
                      cursor: 'pointer',
                      fontSize: '0.78rem',
                      fontStyle: 'italic',
                      padding: '2px 0',
                      marginTop: '2px',
                    }}
                  >
                    … show {count - visibleCount} more items
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  let renderedValue: React.ReactNode;
  let valColor = 'inherit';

  if (typeof value === 'string') {
    renderedValue = JSON.stringify(value);
    valColor = '#95d8a6';
  } else if (typeof value === 'number') {
    renderedValue = String(value);
    valColor = '#f4ca64';
  } else if (typeof value === 'boolean') {
    renderedValue = String(value);
    valColor = '#88b4ff';
  } else if (value === null || value === undefined) {
    renderedValue = String(value);
    valColor = '#6a7d9b';
  } else {
    renderedValue = String(value);
  }

  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.82rem', lineHeight: '1.4' }}>
      {keyName !== undefined && (
        <span style={{ fontWeight: 600, color: 'var(--accent-cyan, #06b6d4)' }}>
          {keyName}:{' '}
        </span>
      )}
      <span style={{ color: valColor }}>{renderedValue}</span>
    </div>
  );
}

function JsonTreeView({ rawValue }: { rawValue: string }) {
  const { parsed, isJson } = useMemo(() => parseJsonValue(rawValue), [rawValue]);

  if (isJson) {
    return <JsonTreeNode value={parsed} depth={0} />;
  }

  return <code>{rawValue}</code>;
}

export default function CodeEditor() {
  const {
    code,
    setCode,
    output,
    isRunning,
    runCode,
    snapshots,
    playback,
  } = usePlayback();

  const {
    selectedSnapshotIndex,
    setSelectedSnapshotIndex,
  } = playback;
  const [editorTheme, setEditorTheme] = useState<'void' | 'ice'>(() => {
    if (typeof window !== 'undefined') {
      const theme = document.documentElement.getAttribute('data-theme');
      return theme === 'light' ? 'ice' : 'void';
    }
    return 'void';
  });
  const [bottomHeight, setBottomHeight] = useState(200);
  const [rightWidth, setRightWidth] = useState(380);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isSashDragging, setIsSashDragging] = useState(false);
  const [dockPosition, setDockPosition] = useState<DockPosition>('bottom');
  const [isEditorReady, setIsEditorReady] = useState(false);

  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragStartX = useRef(0);
  const dragStartHeight = useRef(0);
  const dragStartWidth = useRef(0);

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
    setIsEditorReady(true);
  };

  const highlightLine = useCallback((line: number | null) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    if (line === null) {
      decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      return;
    }

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
  }, []);

  // Synchronize Monaco highlighting with context-driven selection changes
  useEffect(() => {
    if (!isEditorReady) return;

    if (selectedSnapshotIndex === null) {
      highlightLine(null);
    } else {
      const snapshot = snapshots[selectedSnapshotIndex];
      if (snapshot) {
        highlightLine(snapshot.line);
      }
    }
  }, [selectedSnapshotIndex, snapshots, highlightLine, isEditorReady]);

  const selectSnapshot = (index: number) => {
    const snapshot = snapshots[index];
    if (!snapshot) return;
    setSelectedSnapshotIndex(index);
    highlightLine(snapshot.line);
  };

  const scrubToSnapshot = (event: ChangeEvent<HTMLInputElement>) => {
    selectSnapshot(Number(event.target.value));
  };

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
        const newHeight = dragStartHeight.current - deltaY;
        const containerHeight = containerRef.current.getBoundingClientRect().height;
        const minHeight = 60;
        const maxHeight = containerHeight - 120;
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

  const onRightSashMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSashDragging(true);
    dragStartX.current = e.clientX;
    dragStartWidth.current = rightWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const deltaX = moveEvent.clientX - dragStartX.current;
        const newWidth = dragStartWidth.current - deltaX;
        const containerWidth = containerRef.current.getBoundingClientRect().width;
        const minWidth = 200;
        const maxWidth = containerWidth - 200;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setRightWidth(newWidth);
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
  }, [rightWidth]);

  const maximizePanel = () => {
    if (containerRef.current) {
      if (dockPosition === 'bottom') {
        const totalHeight = containerRef.current.getBoundingClientRect().height;
        setBottomHeight(totalHeight);
      } else {
        const totalWidth = containerRef.current.getBoundingClientRect().width;
        setRightWidth(totalWidth - 200);
      }
    }
    setIsMaximized(true);
    setIsCollapsed(false);
  };

  const collapsePanel = () => {
    if (dockPosition === 'bottom') {
      setBottomHeight(38);
    } else {
      setRightWidth(38);
    }
    setIsCollapsed(true);
    setIsMaximized(false);
  };

  const resetPanel = () => {
    setBottomHeight(200);
    setRightWidth(380);
    setIsMaximized(false);
    setIsCollapsed(false);
  };

  const toggleDock = () => {
    setDockPosition(prev => prev === 'bottom' ? 'right' : 'bottom');
    resetPanel();
  };

  // ✅ Shared button style using CSS variables
  const quickBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--border-color)',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    padding: '2px 6px',
    cursor: 'pointer',
    fontSize: '12px',
    lineHeight: 1,
    transition: 'all 0.2s ease',
  };

  // ✅ Constant purple sash — visible in both dark and light mode
  const sashStyle = (isHorizontal: boolean): React.CSSProperties => ({
    [isHorizontal ? 'width' : 'height']: '6px',
    cursor: isMaximized || isCollapsed
      ? 'not-allowed'
      : isHorizontal ? 'ew-resize' : 'ns-resize',
    background: isSashDragging ? '#7c3aed' : '#7c3aed66',
    flexShrink: 0,
    zIndex: 1000,
    transition: 'background 0.15s ease',
    borderTop: isHorizontal ? 'none' : '1px solid #7c3aed',
    borderLeft: isHorizontal ? '1px solid #7c3aed' : 'none',
  });

  // Output panel content shared between both dock modes
  const outputPanelContent = (
    <>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {/* Dock Toggle */}
          <button
            type="button"
            onClick={toggleDock}
            title={dockPosition === 'bottom' ? 'Move to right side' : 'Move to bottom'}
            style={{ ...quickBtnStyle, fontSize: '11px' }}
          >
            {dockPosition === 'bottom' ? '⇒' : '⇓'}
          </button>

          {/* Restore */}
          {isMaximized || isCollapsed ? (
            <button
              type="button"
              onClick={resetPanel}
              title="Restore Normal Layout"
              style={quickBtnStyle}
            >
              🗗
            </button>
          ) : null}

          {/* Collapse */}
          {!isCollapsed && (
            <button
              type="button"
              onClick={collapsePanel}
              title="Collapse Panel"
              style={quickBtnStyle}
            >
              {dockPosition === 'bottom' ? '▼' : '▶'}
            </button>
          )}

          {/* Maximize */}
          {!isMaximized && (
            <button
              type="button"
              onClick={maximizePanel}
              title="Maximize Panel"
              style={quickBtnStyle}
            >
              {dockPosition === 'bottom' ? '▲' : '◀'}
            </button>
          )}
        </div>
      </div>

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
                              <td><JsonTreeView rawValue={value.value} /></td>
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
            <p style={{ padding: '0.5rem', margin: 0 }}>
              Run code to see variable snapshots, loop checkpoints, console output, errors, and timeout status.
            </p>
          )}
        </div>
      )}
    </>
  );

  // ── BOTTOM DOCK ──
  if (dockPosition === 'bottom') {
    return (
      <div
        ref={containerRef}
        className="codeRunner"
        style={{
          display: 'grid',
          height: '100%',
          maxHeight: 'calc(100vh - 120px)',
          minHeight: 0,
          gridTemplateRows: `auto 1fr 6px ${bottomHeight}px`,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isSashDragging && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999, cursor: 'ns-resize', backgroundColor: 'transparent', userSelect: 'none' }} />
        )}

        <div className="runnerToolbar">
          <button className="primaryAction" type="button" onClick={runCode} disabled={isRunning}>
            {isRunning ? 'Tracing…' : 'Trace Execution'}
          </button>
          <span>AST hooks · JavaScript VM · 1s timeout · isolated worker</span>
        </div>

        <div className="monacoPane" style={{ minHeight: 0, overflow: 'hidden' }}>
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

        {/* Vertical Sash */}
        <div
          className={`sash ${isSashDragging ? 'dragging' : ''}`}
          onMouseDown={isMaximized || isCollapsed ? undefined : onSashMouseDown}
          style={sashStyle(false)}
        />

        <div
          className={`outputPane ${output?.ok ? 'success' : output ? 'failure' : ''}`}
          style={{ minHeight: 0, overflow: 'auto', height: `${bottomHeight}px` }}
        >
          {outputPanelContent}
        </div>
      </div>
    );
  }

  // ── RIGHT DOCK ──
  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        maxHeight: 'calc(100vh - 120px)',
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isSashDragging && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, cursor: 'ew-resize', backgroundColor: 'transparent', userSelect: 'none' }} />
      )}

      {/* Left — editor */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div className="runnerToolbar">
          <button className="primaryAction" type="button" onClick={runCode} disabled={isRunning}>
            {isRunning ? 'Tracing…' : 'Trace Execution'}
          </button>
          <span>AST hooks · JavaScript VM · 1s timeout · isolated worker</span>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
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
      </div>

      {/* Horizontal Sash */}
      <div
        onMouseDown={isMaximized || isCollapsed ? undefined : onRightSashMouseDown}
        style={sashStyle(true)}
      />

      {/* Right — output */}
      <div
        className={`outputPane ${output?.ok ? 'success' : output ? 'failure' : ''}`}
        style={{
          width: `${rightWidth}px`,
          minWidth: 0,
          overflow: 'auto',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {outputPanelContent}
      </div>
    </div>
  );
}