import { describe, expect, it } from 'vitest';
import { normalizeExecutionResponse } from './executionResponse';

const response = { ok: true, status: 200 };
const basePayload = {
  ok: true,
  logs: [],
  timeline: [],
};

describe('normalizeExecutionResponse complexity contract', () => {
  it('preserves a valid available complexity estimate', () => {
    const result = normalizeExecutionResponse(
      {
        ...basePayload,
        complexity: {
          available: true,
          bigO: 'O(n)',
          explanation: 'One loop detected.',
        },
      },
      response,
    );

    expect(result.complexity).toEqual({
      available: true,
      bigO: 'O(n)',
      explanation: 'One loop detected.',
    });
  });

  it('preserves an explicitly unavailable estimate', () => {
    const result = normalizeExecutionResponse(
      {
        ...basePayload,
        complexity: {
          available: false,
          bigO: null,
          explanation: 'Not available for this language.',
        },
      },
      response,
    );

    expect(result.complexity?.available).toBe(false);
  });

  it('rejects truthy non-boolean availability values', () => {
    const result = normalizeExecutionResponse(
      {
        ...basePayload,
        complexity: {
          available: 'false',
          bigO: null,
        },
      },
      response,
    );

    expect(result.complexity).toBeUndefined();
  });

  it('rejects inconsistent available estimates without Big-O text', () => {
    const result = normalizeExecutionResponse(
      {
        ...basePayload,
        complexity: {
          available: true,
          bigO: null,
        },
      },
      response,
    );

    expect(result.complexity).toBeUndefined();
  });
});
