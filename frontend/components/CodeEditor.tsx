
'use client';

import Editor, { type Monaco, type OnMount } from '@monaco-editor/react';
import { type ChangeEvent, useMemo, useRef, useState } from 'react';
import Button from '@/components/Button';

const executionApiUrl = process.env.NEXT_PUBLIC_EXECUTE_API_URL ?? 'http://localhost:4000/api/execute';

const starterCode = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const value = 6;
const result = fibonacci(value);
console.log({ value, result });
result;`;

type ExecutionLog = {
  level: string;
  message: string;
};

type SerializedValue = {
  type: string;
  value: string;
};

type TimelineEvent = {
  step: number;
  line: number;
  event: string;
  variables: Record<string, SerializedValue>;
};

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
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const snapshots = output?.timeline ?? [];
  const selectedSnapshot = selectedSnapshotIndex === null ? null : snapshots[selectedSnapshotIndex] ?? null;
  const selectedVariables = selectedSnapshot ? Object.entries(selectedSnapshot.variables) : [];

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

  return (
    <div className="codeRunner">
      <div className="runnerToolbar">
       <Button
  className="primaryAction"
  type="button"
  onClick={runCode}
  disabled={isRunning}
>
  {isRunning ? 'Tracing…' : 'Trace Execution'}
</Button>
        <span>AST hooks · JavaScript VM · 1s timeout · isolated worker</span>
      </div>

      <div className="monacoPane">
        <Editor
          height="100%"
          defaultLanguage="javascript"
          value={code}
          onChange={(value) => setCode(value ?? '')}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorMount}
          theme="void"
          options={options}
        />
      </div>

      <div className={`outputPane ${output?.ok ? 'success' : output ? 'failure' : ''}`}>
        <div className="outputHeader">
          <span>Playback Engine</span>
          {output ? (
            <span>
              {snapshots.length} snapshots · {output.instrumentation?.hookCount ?? 0} hooks · {output.durationMs}ms
            </span>
          ) : (
            <span>Idle</span>
          )}
        </div>
        {output ? (
          <div className="outputBody">
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
                      <span>
                        step #{selectedSnapshot.step} · line {selectedSnapshot.line} · {selectedSnapshot.event}
                      </span>
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
                          <td colSpan={3} className="emptyInspector">
                            No variables changed in this snapshot.
                          </td>
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
          </div>
        ) : (
          <p>Run code to see variable snapshots, loop checkpoints, console output, errors, and timeout status.</p>
        )}
      </div>
    </div>
  );
}
