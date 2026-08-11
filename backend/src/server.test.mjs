import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import express from 'express';
import {
  createCorsMiddleware,
  parseAllowedOrigins,
} from './server.js';

async function withServer(allowedOrigins, callback) {
  const testApp = express();
  testApp.use(createCorsMiddleware(allowedOrigins));
  testApp.use(express.json());
  testApp.post('/api/execute', (_request, response) => {
    response.setHeader('X-Execution-Route', 'reached');
    response.status(200).json({ ok: true });
  });

  const server = testApp.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();

  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    server.close();
    await once(server, 'close');
  }
}

test('parseAllowedOrigins rejects mixed wildcard configurations', () => {
  assert.deepStrictEqual(
    parseAllowedOrigins('https://app.example,*'),
    [],
  );
});

test('CORS middleware allows configured origins and reaches execution', async () => {
  await withServer(['https://app.example'], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/execute`, {
      method: 'POST',
      headers: {
        Origin: 'https://app.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: '1 + 1' }),
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('access-control-allow-origin'), 'https://app.example');
    assert.strictEqual(response.headers.get('x-execution-route'), 'reached');
  });
});

test('CORS middleware rejects disallowed origins before execution', async () => {
  await withServer(['https://app.example'], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/execute`, {
      method: 'POST',
      headers: {
        Origin: 'https://attacker.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: '1 + 1' }),
    });

    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.headers.get('x-execution-route'), null);
    assert.deepStrictEqual(await response.json(), {
      ok: false,
      error: 'Origin is not allowed by the server CORS policy.',
    });
  });
});

test('CORS middleware rejects disallowed preflight requests', async () => {
  await withServer(['https://app.example'], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/execute`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://attacker.example' },
    });

    assert.strictEqual(response.status, 403);
    assert.strictEqual(response.headers.get('access-control-allow-origin'), null);
  });
});

test('CORS middleware permits same-origin requests without Origin', async () => {
  await withServer([], async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: '1 + 1' }),
    });

    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers.get('x-execution-route'), 'reached');
  });
});
