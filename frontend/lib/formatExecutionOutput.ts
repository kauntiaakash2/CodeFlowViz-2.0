import type { ExecutionResponse } from '@/lib/executionResponse';

export function formatExecutionOutput(
  output: ExecutionResponse,
  snapshotCount: number,
): string {
  const lines: string[] = [];

  // Error or Result
  if (output.error) {
    lines.push('Error:');
    lines.push(output.error);
  } else if (output.result) {
    lines.push(`Result (${output.result.type}): ${output.result.value}`);
  }

  // Duration
  if (output.durationMs !== undefined) {
    lines.push(`Duration: ${output.durationMs}ms`);
  }

  // Timeout state
  if (output.timedOut !== undefined) {
    lines.push(`Timed out: ${output.timedOut ? 'Yes' : 'No'}`);
  }

  // Logs
  if (output.logs.length > 0) {
    lines.push('Logs:');

    output.logs.forEach((log) => {
      lines.push(`[${log.level}] ${log.message}`);
    });
  }

  // Snapshot
  if (snapshotCount > 0) {
    lines.push(`Snapshots: ${snapshotCount}`);
  }

  if (output.instrumentation?.hookCount !== undefined) {
    lines.push(`Hooks: ${output.instrumentation.hookCount}`);
  }

  return lines.join('\n');
}