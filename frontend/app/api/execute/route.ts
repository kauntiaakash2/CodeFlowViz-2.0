import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEVELOPMENT_EXECUTION_API_URL = 'http://127.0.0.1:4000/api/execute';
const UPSTREAM_TIMEOUT_MS = 8_000;

function executionError(error: string, status = 503) {
  return NextResponse.json(
    {
      ok: false,
      error,
      logs: [],
      timeline: [],
      durationMs: 0,
      timedOut: false,
    },
    { status },
  );
}

function getExecutionApiUrl() {
  const configuredUrl =
    process.env.EXECUTE_API_URL ?? process.env.NEXT_PUBLIC_EXECUTE_API_URL;

  if (configuredUrl) return configuredUrl;
  if (process.env.NODE_ENV !== 'production') return DEVELOPMENT_EXECUTION_API_URL;
  return null;
}

export async function POST(request: Request) {
  const configuredUrl = getExecutionApiUrl();
  if (!configuredUrl) {
    return executionError(
      'Execution backend is not configured. Set EXECUTE_API_URL on the frontend deployment.',
    );
  }

  let executionApiUrl: URL;
  try {
    executionApiUrl = new URL(configuredUrl);
  } catch {
    return executionError('EXECUTE_API_URL is not a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(executionApiUrl.protocol)) {
    return executionError('EXECUTE_API_URL must use HTTP or HTTPS.');
  }

  const requestUrl = new URL(request.url);
  if (
    executionApiUrl.origin === requestUrl.origin &&
    executionApiUrl.pathname === requestUrl.pathname
  ) {
    return executionError(
      'EXECUTE_API_URL points back to the frontend proxy. Configure the deployed backend URL instead.',
    );
  }

  try {
    const upstreamResponse = await fetch(executionApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') ?? 'application/json',
      },
      body: await request.text(),
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    const responseHeaders = new Headers({
      'Cache-Control': 'no-store',
      'Content-Type':
        upstreamResponse.headers.get('content-type') ?? 'application/json',
    });

    for (const headerName of [
      'retry-after',
      'ratelimit-limit',
      'ratelimit-remaining',
      'ratelimit-reset',
    ]) {
      const value = upstreamResponse.headers.get(headerName);
      if (value) responseHeaders.set(headerName, value);
    }

    return new Response(await upstreamResponse.text(), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');

    return executionError(
      timedOut
        ? 'Execution backend did not respond in time.'
        : 'Execution backend is unreachable. Check the backend deployment and EXECUTE_API_URL.',
      timedOut ? 504 : 502,
    );
  }
}
