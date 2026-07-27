
import { PlaybackProvider } from '@/context/PlaybackContext';
import FlowControls from '@/components/FlowControls';
import CodeEditor from '@/components/CodeEditor';
import ThemeToggle from '@/components/ThemeToggle'; 

export default function HomePage() {
  return (
    <PlaybackProvider>
      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">CodeFlowViz 2.0</p>
            <h1>Execution Cockpit</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ThemeToggle />
            <span style={{ fontSize: "0.9rem", color: "#98b6ef" }}>Sandbox Ready</span>
          </div>
        </header>

        <section className="workspace">
          <FlowControls />

          <section className="panel editor" style={{ minHeight: '600px' }}>
            <div className="panelTitle">Code Editor</div>
            <div className="editorWrap" style={{ height: 'calc(100% - 48px)' }}>
              <CodeEditor />
            </div>
          </section>

          <aside className="panel right">
            <h2>Runtime Introspection</h2>
            <p>Trace events, highlighted source lines, console logs, errors, and timeout status stream back from the execution API.</p>
          </aside>
        </section>
      </main>
    </PlaybackProvider>
  );
}
