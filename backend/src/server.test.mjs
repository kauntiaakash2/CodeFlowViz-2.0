import test from 'node:test';
import assert from 'node:assert/strict';

process.env.PORT = '0';

const { app } = await import('./server.js');

function startServer() {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

function stopServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function getUrl(server) {
  const address = server.address();
  return `http://127.0.0.1:${address.port}`;
}

test('POST /api/execute request body handling', async (t) => {
  const server = await startServer();
  const baseUrl = getUrl(server);

  t.after(async () => {
    await stopServer(server);
  });

  await t.test('accepts a JSON body near the 64 KB limit', async () => {
  const body = JSON.stringify({
    code: 'console.log("hello");',
    padding: 'a'.repeat(63_000),
    language: 'javascript',
  });

  const response = await fetch(`${baseUrl}/api/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  const responseBody = await response.json();

  assert.notStrictEqual(
    responseBody.error,
    'Request body exceeds the 64 KB limit.',
    'body near the limit should pass JSON body parsing'
  );
});

  await t.test('returns structured 413 for JSON above the 64 KB limit', async () => {
    const body = JSON.stringify({
      code: 'a'.repeat(70_000),
      language: 'javascript',
    });

    assert.ok(
      Buffer.byteLength(body) > 64 * 1024,
      'test payload should exceed 64 KB'
    );

    const response = await fetch(`${baseUrl}/api/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    const responseBody = await response.json();

    assert.strictEqual(response.status, 413);

    assert.deepStrictEqual(responseBody, {
      ok: false,
      error: 'Request body exceeds the 64 KB limit.',
      logs: [],
      timeline: [],
      durationMs: 0,
      timedOut: false,
    });
  });
});