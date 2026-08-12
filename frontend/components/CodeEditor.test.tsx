import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionResponse } from '@/lib/executionResponse';
import CodeEditor from './CodeEditor';

const usePlaybackMock = vi.hoisted(() => vi.fn());

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor" />,
}));

vi.mock('@/lib/monacoWorkerSetup', () => ({
  initializeMonaco: () => Promise.resolve(),
  subscribeWorkerStatus: (listener: (status: 'workers') => void) => {
    listener('workers');
    return () => undefined;
  },
}));

vi.mock('@/context/PlaybackContext', () => ({
  usePlayback: usePlaybackMock,
}));

const output: ExecutionResponse = {
  ok: true,
  result: {
    type: 'number',
    value: '8',
  },
  logs: [],
  timeline: [],
  durationMs: 12,
  timedOut: false,
};

function mockPlayback(currentOutput: ExecutionResponse | null) {
  usePlaybackMock.mockReturnValue({
    code: '',
    setCode: vi.fn(),
    output: currentOutput,
    isRunning: false,
    runCode: vi.fn(),
    snapshots: currentOutput?.timeline ?? [],
    playback: {
      selectedSnapshotIndex: null,
      setSelectedSnapshotIndex: vi.fn(),
    },
  });
}

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
}

describe('CodeEditor copy output action', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('does not show the copy action when there is no output', () => {
    mockPlayback(null);

    render(<CodeEditor />);

    expect(screen.queryByRole('button', { name: 'Copy output' })).not.toBeInTheDocument();
  });

  it('copies the formatted output and announces success', async () => {
    mockPlayback(output);
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    render(<CodeEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy output' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(
      'Result (number): 8\nDuration: 12ms\nTimed out: No',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Output copied');
  });

  it('announces clipboard failures without blocking the interface', async () => {
    mockPlayback(output);
    mockClipboard(vi.fn().mockRejectedValue(new Error('Permission denied')));

    render(<CodeEditor />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy output' }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Unable to copy output.');
    });
  });

  it('replaces the previous status timer and clears the latest message', async () => {
    vi.useFakeTimers();
    mockPlayback(output);
    mockClipboard(vi.fn().mockResolvedValue(undefined));

    render(<CodeEditor />);
    const copyButton = screen.getByRole('button', { name: 'Copy output' });

    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Output copied');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    await act(async () => {
      fireEvent.click(copyButton);
      await Promise.resolve();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Output copied');

    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('CodeEditor timeout selector', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('renders the timeout selector with the default 1s option selected', () => {
    mockPlayback(null);

    render(<CodeEditor />);

    const selector = screen.getByLabelText('Execution timeout') as HTMLSelectElement;
    expect(selector).toBeInTheDocument();
    expect(selector.value).toBe('1000');
  });

  it('updates the timeout value when a new option is selected', () => {
    mockPlayback(null);

    render(<CodeEditor />);

    const selector = screen.getByLabelText('Execution timeout') as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: '3000' } });
    expect(selector.value).toBe('3000');
  });

  it('disables the timeout selector while the code is running', () => {
    usePlaybackMock.mockReturnValue({
      code: '',
      setCode: vi.fn(),
      output: null,
      isRunning: true,
      runCode: vi.fn(),
      snapshots: [],
      playback: {
        selectedSnapshotIndex: null,
        setSelectedSnapshotIndex: vi.fn(),
      },
    });

    render(<CodeEditor />);

    const selector = screen.getByLabelText('Execution timeout') as HTMLSelectElement;
    expect(selector).toBeDisabled();
  });

  it('calls runCode with the selected timeout when Trace Execution is clicked', async () => {
    const runCodeMock = vi.fn().mockResolvedValue(undefined);
    usePlaybackMock.mockReturnValue({
      code: 'console.log(1)',
      setCode: vi.fn(),
      output: null,
      isRunning: false,
      runCode: runCodeMock,
      snapshots: [],
      playback: {
        selectedSnapshotIndex: null,
        setSelectedSnapshotIndex: vi.fn(),
      },
    });

    render(<CodeEditor />);

    // Change to 2s timeout
    const selector = screen.getByLabelText('Execution timeout') as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: '2000' } });

    const traceBtn = screen.getAllByRole('button', { name: /Trace Execution/i })[0];
    await act(async () => {
      fireEvent.click(traceBtn);
    });

    expect(runCodeMock).toHaveBeenCalledWith(2000);
  });

  it('renders the timed-out banner when output.timedOut is true', () => {
    const timedOutOutput: ExecutionResponse = {
      ok: false,
      error: 'Execution timed out after 1000ms.',
      logs: [],
      timeline: [],
      durationMs: 1001,
      timedOut: true,
    };
    mockPlayback(timedOutOutput);

    render(<CodeEditor />);

    expect(screen.getByRole('heading', { name: /Execution Timed Out/i })).toBeInTheDocument();
    expect(screen.getByText(/maximum allowed execution time/i)).toBeInTheDocument();
  });

  it('renders a plain error (not timed-out) for non-timeout errors', () => {
    const errorOutput: ExecutionResponse = {
      ok: false,
      error: 'ReferenceError: x is not defined',
      logs: [],
      timeline: [],
      durationMs: 10,
      timedOut: false,
    };
    mockPlayback(errorOutput);

    render(<CodeEditor />);

    expect(screen.queryByRole('heading', { name: /Execution Timed Out/i })).not.toBeInTheDocument();
    expect(screen.getByText('ReferenceError: x is not defined')).toBeInTheDocument();
  });

  it('regression: banner shows submitted timeout even when selector is changed after run', async () => {
    // Start with no output, simulate a 3s run that timed out
    const runCodeMock = vi.fn().mockResolvedValue(undefined);
    usePlaybackMock.mockReturnValue({
      code: 'while(true){}',
      setCode: vi.fn(),
      output: null,
      isRunning: false,
      runCode: runCodeMock,
      snapshots: [],
      playback: {
        selectedSnapshotIndex: null,
        setSelectedSnapshotIndex: vi.fn(),
      },
    });

    const { rerender } = render(<CodeEditor />);

    // Change timeout selector to 3s and click Trace
    const selector = screen.getAllByLabelText('Execution timeout')[0] as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: '3000' } });

    const traceBtn = screen.getAllByRole('button', { name: /Trace Execution/i })[0];
    await act(async () => {
      fireEvent.click(traceBtn);
    });

    // Now simulate a timed-out response arriving
    const timedOutOutput: ExecutionResponse = {
      ok: false,
      error: 'Execution timed out after 3000ms.',
      logs: [],
      timeline: [],
      durationMs: 3001,
      timedOut: true,
    };
    usePlaybackMock.mockReturnValue({
      code: 'while(true){}',
      setCode: vi.fn(),
      output: timedOutOutput,
      isRunning: false,
      runCode: runCodeMock,
      snapshots: [],
      playback: {
        selectedSnapshotIndex: null,
        setSelectedSnapshotIndex: vi.fn(),
      },
    });
    rerender(<CodeEditor />);

    // User changes selector to 5s AFTER the run completed
    const selectorAfter = screen.getAllByLabelText('Execution timeout')[0] as HTMLSelectElement;
    fireEvent.change(selectorAfter, { target: { value: '5000' } });

    // Banner must still report 3s (the value used for the execution), not 5s
    const banner = screen.getByRole('heading', { name: /Execution Timed Out/i });
    expect(banner).toBeInTheDocument();
    expect(screen.getByText(/3 seconds/i)).toBeInTheDocument();
    expect(screen.queryByText(/5 seconds/i)).not.toBeInTheDocument();
  });
});
