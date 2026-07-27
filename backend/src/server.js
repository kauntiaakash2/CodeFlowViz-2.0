import { estimateComplexity } from './tracing/complexityAnalyzer.mjs';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const DEFAULT_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 100;
const MAX_CODE_LENGTH = 20_000;
const DEFAULT_PORT = 4000;
const SUPPORTED_LANGUAGES = new Set(['javascript', 'java']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, 'sandbox/executeWorker.mjs');

const app = express();
const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);
const allowedOrigin = process.env.CORS_ORIGIN ?? '*';

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: '64kb' }));

function normalizeTimeout(timeoutMs) {
  if (typeof timeoutMs !== 'number' || Number.isNaN(timeoutMs)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(timeoutMs)));
}

function runInSandbox(code, timeoutMs, language = 'javascript') {
  const startedAt = performance.now();

  if (!language) {
    return Promise.resolve({ ok: false, error: '`language` is required.', logs: [], timeline: [], durationMs: 0, timedOut: false });
  }

  if (!SUPPORTED_LANGUAGES.has(language)) {
    return Promise.resolve({ ok: false, error: `Unsupported language: "${language}". Supported: ${[...SUPPORTED_LANGUAGES].join(', ')}.`, logs: [], timeline: [], durationMs: 0, timedOut: false });
  }

  return new Promise((resolve) => {
    const worker = new Worker(workerPath, {
      workerData: { code, timeoutMs, language },
      resourceLimits: {
        maxOldGenerationSizeMb: 32,
        maxYoungGenerationSizeMb: 8,
        stackSizeMb: 1,
      },
    });

    let settled = false;
    let messageReceived = false;
    const killTimer = setTimeout(() => {
      finish({ ok: false, error: `Execution timed out after ${timeoutMs}ms.` }, true);
    }, timeoutMs + 100);

    function finish(response, timedOut = false) {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      clearTimeout(graceTimer);
      worker.terminate().catch(() => undefined);
      resolve({
        ...response,
        logs: response.logs ?? [],
        timeline: response.timeline ?? [],
        durationMs: Math.round(performance.now() - startedAt),
        timedOut,
      });
    }

    worker.once('message', (message) => {
      messageReceived = true;
      finish(message);
    });
    worker.once('error', (error) => finish({ ok: false, error: error.message }));
    worker.once('exit', (code) => {
      if (!messageReceived) {
        finish({ ok: false, error: code !== 0 ? `Sandbox worker exited with code ${code}.` : 'Worker exited without sending a result.' });
      }
    });

    const graceTimer = setTimeout(() => {
      if (!messageReceived && !settled) {
        finish({ ok: false, error: 'Worker did not respond within the grace period.' });
      }
    }, timeoutMs + 200);
  });
}

function healthResponse(_request, response) {
  response.status(200).json({
    status: 'ok',
    service: 'codeflowviz-backend',
    timestamp: new Date().toISOString(),
  });
}

app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

app.post('/api/execute', async (request, response) => {
  const { code, timeoutMs, language = 'javascript' } = request.body ?? {};

  if (typeof code !== 'string') {
    response.status(400).json({ ok: false, error: '`code` must be a string.' });
    return;
  }

  if (code.length > MAX_CODE_LENGTH) {
    response.status(413).json({ ok: false, error: `Code exceeds the ${MAX_CODE_LENGTH} character limit.` });
    return;
  }

  // 1. Generate the Big-O Estimate from the AST (skip for non-JavaScript languages)
  const isJavaScript = language === 'javascript' || language === 'js';
  const complexityEstimate = isJavaScript ? estimateComplexity(code) : { bigO: 'Unknown', explanation: 'Complexity analysis only available for JavaScript' };

  const normalizedTimeoutMs = normalizeTimeout(timeoutMs);
  const result = await runInSandbox(code, normalizedTimeoutMs, language);
  
  // 2. Attach the complexity to the successful result
  if (result.ok) {
    result.complexity = complexityEstimate;
  }

  response.status(result.ok ? 200 : 422).json(result);
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ ok: false, error: 'Request body must be valid JSON.' });
    return;
  }

  response.status(500).json({ ok: false, error: 'Unexpected backend error.' });
});

app.listen(port, () => {
  console.log(`CodeFlowViz backend listening on http://localhost:${port}`);
});
