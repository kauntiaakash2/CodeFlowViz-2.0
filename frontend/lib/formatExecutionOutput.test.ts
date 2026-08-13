import { describe, expect, it } from 'vitest';
import { formatExecutionOutput } from './formatExecutionOutput';
import type { ExecutionResponse } from './executionResponse';

describe('formatExecutionOutput', () => {
  it('formats successful execution output', () => {
    const output: ExecutionResponse = {
      ok: true,
      result: {
        type: 'number',
        value: '8',
      },
      logs: [
        {
          level: 'log',
          message: '8',
        },
      ],
      timeline: [],
      instrumentation: {
        hookCount: 4,
      },
      durationMs: 24,
      timedOut: false,
    };

    expect(formatExecutionOutput(output, 6)).toBe(
`Result (number): 8
Duration: 24ms
Timed out: No
Logs:
[log] 8
Snapshots: 6
Hooks: 4`
    );
  });

  it('formats error-only output', () => {
    const output: ExecutionResponse = {
      ok: false,
      error: 'Unknown sandbox error',
      logs: [],
      timeline: [],
      durationMs: 54,
      timedOut: false,
    };

    expect(formatExecutionOutput(output, 0)).toBe(
`Error:
Unknown sandbox error
Duration: 54ms
Timed out: No`
    );
  });

  it('omits empty logs', () => {
    const output: ExecutionResponse = {
      ok: true,
      result: {
        type: 'string',
        value: 'done',
      },
      logs: [],
      timeline: [],
      durationMs: 10,
      timedOut: false,
    };

    const text = formatExecutionOutput(output, 0);

    expect(text).not.toContain('Logs:');
  });

  it('omits snapshots when there are none', () => {
    const output: ExecutionResponse = {
      ok: true,
      result: {
        type: 'number',
        value: '1',
      },
      logs: [],
      timeline: [],
    };

    const text = formatExecutionOutput(output, 0);

    expect(text).not.toContain('Snapshots:');
  });

  it('omits hooks when the hook count is zero', () => {
    const output: ExecutionResponse = {
      ok: true,
      logs: [],
      timeline: [],
      instrumentation: {
        hookCount: 0,
      },
    };

    expect(formatExecutionOutput(output, 0)).not.toContain('Hooks:');
  });

  it('formats timeout state', () => {
    const output: ExecutionResponse = {
      ok: false,
      error: 'Execution timed out.',
      logs: [],
      timeline: [],
      durationMs: 1000,
      timedOut: true,
    };

    expect(formatExecutionOutput(output, 0)).toContain(
      'Timed out: Yes',
    );
  });
});
