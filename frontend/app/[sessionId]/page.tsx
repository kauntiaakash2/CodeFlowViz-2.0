'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import CodeEditor, { type ExecutionResponse } from '@/components/CodeEditor';
import ThemeToggle from '@/components/ThemeToggle';

interface SessionData {
  code: string;
  output: ExecutionResponse | null;
  selectedSnapshotIndex: number | null;
}

export default function SharedSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [isLoading, setIsLoading] = useState(true);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const executionApiUrl = process.env.NEXT_PUBLIC_EXECUTE_API_URL ?? 'http://localhost:4000/api/execute';
        const apiBaseUrl = executionApiUrl.replace(/\/api\/execute$/, '');
        const sessionsApiUrl = `${apiBaseUrl}/api/sessions/${sessionId}`;

        const response = await fetch(sessionsApiUrl);
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || 'Session not found or expired.');
        }

        const data = await response.json();
        setSessionData(data.session);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to retrieve the shared session.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  if (isLoading) {
    return (
      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">CodeFlowViz 2.0</p>
            <h1>Shared Execution Cockpit</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ThemeToggle />
            <span style={{ fontSize: "0.9rem", color: "#98b6ef" }}>Loading Trace...</span>
          </div>
        </header>

        <section className="workspace" style={{ opacity: 0.6, pointerEvents: 'none' }}>
          <aside className="panel left">
            <h2>Flow Controls</h2>
            <p>Loading session workspace configuration...</p>
          </aside>
          <section className="panel editor" style={{ minHeight: '600px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ border: '4px solid #1f2f50', borderTop: '4px solid #7c3aed', borderRadius: '50%', width: '48px', height: '48px', animation: 'spin 1s linear infinite' }} />
          </section>
          <aside className="panel right">
            <h2>Runtime Introspection</h2>
            <p>Loading execution snapshots...</p>
          </aside>
        </section>
      </main>
    );
  }

  if (error || !sessionData) {
    return (
      <main className="shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">CodeFlowViz 2.0</p>
            <h1>Shared Execution Cockpit</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ThemeToggle />
          </div>
        </header>

        <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '4rem 1rem', gap: '16px' }}>
          <span style={{ fontSize: '4rem' }}>🔍</span>
          <h2>Session Not Found or Expired</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '400px', textAlign: 'center', margin: 0, fontSize: '0.95rem' }}>
            {error || 'The debugging session you are looking for might have expired (sessions live for 24 hours) or does not exist.'}
          </p>
          <a href="/" style={{
            backgroundColor: 'var(--accent-blue)',
            color: 'white',
            padding: '10px 24px',
            borderRadius: '10px',
            textDecoration: 'none',
            fontWeight: 'bold',
            boxShadow: '0 0 20px rgba(124, 58, 237, 0.3)',
            marginTop: '12px',
            fontSize: '0.9rem',
          }}>
            Start New Session
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">CodeFlowViz 2.0</p>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            Execution Cockpit <span style={{ fontSize: '0.8rem', padding: '2px 8px', borderRadius: '12px', backgroundColor: 'rgba(124, 58, 237, 0.2)', border: '1px solid #7c3aed', color: '#a78bfa', fontWeight: 'normal' }}>Shared Session</span>
          </h1>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ThemeToggle />
          <span style={{ fontSize: "0.9rem", color: "#06b6d4" }}>Hydrated</span>
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
            <CodeEditor initialSession={sessionData} />
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
