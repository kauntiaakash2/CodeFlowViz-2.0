'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePlaybackScrubber, type TimelineEvent } from '@/hooks/usePlaybackScrubber';
import {
  normalizeExecutionResponse,
  type ExecutionResponse,
} from '@/lib/executionResponse';

export type { ExecutionResponse } from '@/lib/executionResponse';

interface PlaybackContextType {
  code: string;
  setCode: React.Dispatch<React.SetStateAction<string>>;
  output: ExecutionResponse | null;
  setOutput: React.Dispatch<React.SetStateAction<ExecutionResponse | null>>;
  isRunning: boolean;
  runCode: () => Promise<void>;
  snapshots: TimelineEvent[];
  playback: ReturnType<typeof usePlaybackScrubber>;
}

const PlaybackContext = createContext<PlaybackContextType | undefined>(undefined);

const starterCode = `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

const value = 6;
const result = fibonacci(value);
console.log({ value, result });
result;`;

export function PlaybackProvider({
  children,
  initialSession,
}: {
  children: React.ReactNode;
  initialSession?: {
    code: string;
    output: ExecutionResponse | null;
    selectedSnapshotIndex: number | null;
  } | null;
}) {
  const [code, setCode] = useState(initialSession?.code ?? starterCode);
  const [output, setOutput] = useState<ExecutionResponse | null>(initialSession?.output ?? null);
  const [isRunning, setIsRunning] = useState(false);
  const isRequestPendingRef = useRef(false);

  const snapshots = useMemo(() => output?.timeline ?? [], [output]);

  const playback = usePlaybackScrubber({
    snapshots,
    initialIndex: initialSession?.selectedSnapshotIndex ?? null,
  });

  const runCode = useCallback(async () => {
    if (isRequestPendingRef.current) return;
    isRequestPendingRef.current = true;

    playback.pause();
    setIsRunning(true);
    setOutput(null);
    playback.setSelectedSnapshotIndex(null);

    const executionApiUrl = process.env.NEXT_PUBLIC_EXECUTE_API_URL ?? 'http://localhost:4000/api/execute';
    try {
      const response = await fetch(executionApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, timeoutMs: 1000 }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const result = normalizeExecutionResponse(payload, response);

      setOutput(result);
      if (result.timeline?.[0]) {
        playback.setSelectedSnapshotIndex(0);
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
      isRequestPendingRef.current = false;
      setIsRunning(false);
    }
  }, [code, playback.pause, playback.setSelectedSnapshotIndex]);

  const contextValue = useMemo(
    () => ({
      code,
      setCode,
      output,
      setOutput,
      isRunning,
      runCode,
      snapshots,
      playback,
    }),
    [code, output, isRunning, runCode, snapshots, playback],
  );

  return (
    <PlaybackContext.Provider value={contextValue}>
      {children}
    </PlaybackContext.Provider>
  );
}

export function usePlayback() {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
}
