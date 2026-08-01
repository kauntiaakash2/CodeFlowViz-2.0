import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RequestQueue } from '../requestQueue.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, 'executeWorker.mjs');

const SUPPORTED_LANGUAGES = new Set(['javascript', 'java']);
const MAX_CONCURRENT_WORKERS = 4;
const workerQueue = new RequestQueue(MAX_CONCURRENT_WORKERS);

export function runInSandbox(code, timeoutMs, language = 'javascript') {
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

export function executeInWorker(code, timeoutMs, language, startedAt = performance.now()) {
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
      worker.terminate().catch(() => undefined).finally(() => workerQueue.release());
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
