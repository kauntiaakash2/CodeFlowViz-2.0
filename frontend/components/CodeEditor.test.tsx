import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the Monaco editor: it doesn't render meaningfully in jsdom, and Issue #118
// only concerns the toolbar counter — the real editor behavior is unaffected.
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange?: (v: string) => void }) => (
    <textarea
      data-testid="mock-monaco-editor"
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}));

// Mock the playback context so we can drive `code` directly per test case.
const mockUsePlayback = jest.fn();
jest.mock('@/context/PlaybackContext', () => ({
  usePlayback: () => mockUsePlayback(),
}));

import CodeEditor from './CodeEditor';

const MAX_CODE_LENGTH = 20000;

function setup(codeLength: number) {
  const code = 'a'.repeat(codeLength);
  mockUsePlayback.mockReturnValue({
    code,
    setCode: jest.fn(),
    output: null,
    isRunning: false,
    runCode: jest.fn(),
    snapshots: [],
    playback: {
      selectedSnapshotIndex: null,
      setSelectedSnapshotIndex: jest.fn(),
      isPlaying: false,
      play: jest.fn(),
      pause: jest.fn(),
      reset: jest.fn(),
      stepInto: jest.fn(),
      stepOver: jest.fn(),
      stepBack: jest.fn(),
    },
  });

  return render(<CodeEditor />);
}

function traceButtons() {
  // Issue #118 requires the counter/behavior in both the bottom dock and right
  // dock toolbars. This component only renders one dock at a time by default
  // (bottom), so we assert against whatever "Trace Execution" button(s) render.
  return screen.getAllByRole('button', { name: /trace execution/i });
}

describe('Issue #118 — live character counter', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('shows the normal state below the limit and keeps Trace Execution enabled', () => {
    setup(1240);

    expect(screen.getByText('1,240 / 20,000')).toBeInTheDocument();
    expect(screen.queryByText('Approaching character limit')).not.toBeInTheDocument();
    expect(screen.queryByText('Shorten the code to run it')).not.toBeInTheDocument();

    traceButtons().forEach((btn) => expect(btn).not.toBeDisabled());
  });

  it('stays in the normal state just below the 18,500 warning threshold', () => {
    setup(18499);

    expect(screen.getByText('18,499 / 20,000')).toBeInTheDocument();
    expect(screen.queryByText('Approaching character limit')).not.toBeInTheDocument();
    expect(screen.queryByText('Shorten the code to run it')).not.toBeInTheDocument();

    traceButtons().forEach((btn) => expect(btn).not.toBeDisabled());
  });

  it('shows the warning state near the threshold and keeps Trace Execution enabled', () => {
    setup(18500);

    expect(screen.getByText('18,500 / 20,000')).toBeInTheDocument();
    expect(screen.getByText('Approaching character limit')).toBeInTheDocument();
    expect(screen.queryByText('Shorten the code to run it')).not.toBeInTheDocument();

    traceButtons().forEach((btn) => expect(btn).not.toBeDisabled());
  });

  it('keeps Trace Execution enabled at exactly the limit (20,000 characters)', () => {
    setup(MAX_CODE_LENGTH);

    expect(screen.getByText('20,000 / 20,000')).toBeInTheDocument();
    expect(screen.queryByText('Shorten the code to run it')).not.toBeInTheDocument();

    traceButtons().forEach((btn) => expect(btn).not.toBeDisabled());
  });

  it('shows the exceeded state and disables Trace Execution above the limit', () => {
    setup(20250);

    expect(screen.getByText('20,250 / 20,000')).toBeInTheDocument();
    expect(screen.getByText('Shorten the code to run it')).toBeInTheDocument();
    expect(screen.queryByText('Approaching character limit')).not.toBeInTheDocument();

    traceButtons().forEach((btn) => expect(btn).toBeDisabled());
  });

  it('leaves the Monaco editor editable even when the code is over the limit', () => {
    setup(20250);

    const editor = screen.getByTestId('mock-monaco-editor');
    expect(editor).not.toBeDisabled();
  });
});
