import { estimateComplexity } from './tracing/complexityAnalyzer.mjs';
import { RequestQueue } from './requestQueue.mjs';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import rateLimit from 'express-rate-limit';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

const DEFAULT_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 100;
const MAX_CODE_LENGTH = 20_000;
const DEFAULT_PORT = 4000;
const SUPPORTED_LANGUAGES = new Set(['javascript', 'java']);
const MAX_CONCURRENT_WORKERS = 4;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, 'sandbox/executeWorker.mjs');

const workerQueue = new RequestQueue(MAX_CONCURRENT_WORKERS);

export function treeKill(pid) {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 1) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGTERM');
      setTimeout(() => {
        try { process.kill(-pid, 'SIGKILL'); } catch {}
      }, 2000);
    }
  } catch {
    // process already exited
  }
}

export function cleanupWorkerResources(resources) {
  if (!resources) return;
  for (const pid of resources.pids) {
    treeKill(pid);
  }
  if (resources.tempDir) {
    try {
      rmSync(resources.tempDir, { recursive: true, force: true });
    } catch {
      // already cleaned up or doesn't exist
    }
  }
  resources.pids.clear();
}

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

const executeLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please slow down.' },
});

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

  return workerQueue.acquire().then(() => {
    return executeInWorker(code, timeoutMs, language, startedAt);
  });
}

const workerResources = new WeakMap();

export { workerResources };

function executeInWorker(code, timeoutMs, language, startedAt) {
  return new Promise((resolve) => {
    let worker;
    try {
      worker = new Worker(workerPath, {
        workerData: { code, timeoutMs, language },
        resourceLimits: {
          maxOldGenerationSizeMb: 32,
          maxYoungGenerationSizeMb: 8,
          stackSizeMb: 1,
        },
      });
    } catch (err) {
      workerQueue.release();
      resolve({ ok: false, error: err.message, logs: [], timeline: [], durationMs: Math.round(performance.now() - startedAt), timedOut: false });
      return;
    }

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
      const resources = workerResources.get(worker);
      cleanupWorkerResources(resources);
      workerResources.delete(worker);
      worker.terminate().catch(() => undefined).finally(() => workerQueue.release());
      resolve({
        ...response,
        logs: response.logs ?? [],
        timeline: response.timeline ?? [],
        durationMs: Math.round(performance.now() - startedAt),
        timedOut,
      });
    }

    worker.on('message', (message) => {
      if (message && message.type === 'child-processes') {
        workerResources.set(worker, {
          pids: new Set(message.pids),
          tempDir: message.tempDir,
        });
        return;
      }

      if (!messageReceived) {
        messageReceived = true;
        finish(message);
      }
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

app.post('/api/execute', executeLimiter, async (request, response) => {
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

  let result;
  try {
    result = await runInSandbox(code, normalizedTimeoutMs, language);
  } catch (err) {
    response.status(503).json({ ok: false, error: err.message, logs: [], timeline: [], durationMs: 0, timedOut: false });
    return;
  }

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

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMainModule) {
  app.listen(port, () => {
    console.log(`CodeFlowViz backend listening on http://localhost:${port}`);
  });
}
