import type { TimelineEvent } from '@/hooks/usePlaybackScrubber';

export interface ExecutionResponse {
  ok: boolean;
  error?: string;
  result?: { type: string; value: string };
  logs: Array<{ level: string; message: string }>;
  timeline: TimelineEvent[];
  instrumentation?: { hookCount: number };
  durationMs?: number;
  timedOut?: boolean;
}

type ResponseStatus = Pick<Response, 'ok' | 'status'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isExecutionLog(value: unknown): value is ExecutionResponse['logs'][number] {
  return (
    isRecord(value) &&
    typeof value.level === 'string' &&
    typeof value.message === 'string'
  );
}

function isTimelineEvent(value: unknown): value is TimelineEvent {
  return (
    isRecord(value) &&
    typeof value.step === 'number' &&
    typeof value.line === 'number' &&
    typeof value.event === 'string' &&
    isRecord(value.variables)
  );
}

export function normalizeExecutionResponse(
  payload: unknown,
  response: ResponseStatus,
): ExecutionResponse {
  if (!isRecord(payload) || typeof payload.ok !== 'boolean') {
    throw new Error(`Execution API returned an invalid response (${response.status}).`);
  }

  const ok = response.ok && payload.ok;
  const error =
    typeof payload.error === 'string'
      ? payload.error
      : ok
        ? undefined
        : response.ok
          ? 'Execution failed.'
          : `Execution failed (${response.status}).`;

  const result =
    isRecord(payload.result) &&
    typeof payload.result.type === 'string' &&
    typeof payload.result.value === 'string'
      ? { type: payload.result.type, value: payload.result.value }
      : undefined;

  const instrumentation =
    isRecord(payload.instrumentation) &&
    typeof payload.instrumentation.hookCount === 'number'
      ? { hookCount: payload.instrumentation.hookCount }
      : undefined;

  return {
    ok,
    error,
    result,
    logs: Array.isArray(payload.logs) ? payload.logs.filter(isExecutionLog) : [],
    timeline: Array.isArray(payload.timeline)
      ? payload.timeline.filter(isTimelineEvent)
      : [],
    instrumentation,
    durationMs:
      typeof payload.durationMs === 'number' ? payload.durationMs : undefined,
    timedOut: payload.timedOut === true,
  };
}
