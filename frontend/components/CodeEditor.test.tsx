import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExecutionResponse } from '@/lib/executionResponse';
import CodeEditor from './CodeEditor';

const usePlaybackMock = vi.hoisted(() => vi.fn());

vi.mock('@monaco-editor/react', () => ({
  default: () => <div data-testid="monaco-editor" />,
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
