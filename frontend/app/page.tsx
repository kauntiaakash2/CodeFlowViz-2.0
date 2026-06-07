
import CodeEditor from '@/components/CodeEditor';
import ThemeToggle from '@/components/ThemeToggle'; 

export default function HomePage() {
  return (
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
        <aside className="panel left">
          <h2>Flow Controls</h2>
          <p>Execute JavaScript through AST instrumentation, then replay assignment snapshots and loop checkpoints.</p>
          <button disabled>Step Into</button>
          <button disabled>Step Over</button>
          <button disabled>Reset</button>
        </aside>

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
  );
}
