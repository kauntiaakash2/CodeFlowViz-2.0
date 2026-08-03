import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
import { RequestQueue } from '../requestQueue.mjs';
import { treeKill } from './processTreeKill.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, 'executeWorker.mjs');

const SUPPORTED_LANGUAGES = new Set(['javascript', 'java']);
const MAX_CONCURRENT_WORKERS = 4;
const workerQueue = new RequestQueue(MAX_CONCURRENT_WORKERS);

const workerResources = new WeakMap();

export { workerResources };

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeDir(dir) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await rm(dir, { recursive: true, force: true });
      return;
    } catch {
      await delay(100);
    }
  }
}

export async function cleanupWorkerResources(resources) {
  if (!resources) return;
  for (const pid of resources.pids) {
    await treeKill(pid);
  }
  if (resources.tempDir) {
    await removeDir(resources.tempDir);
  }
  resources.pids.clear();
}

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

    async function finish(response, timedOut = false) {
      if (settled) return;
      settled = true;
      clearTimeout(killTimer);
      clearTimeout(graceTimer);
      const resources = workerResources.get(worker);
      workerResources.delete(worker);
      await cleanupWorkerResources(resources);
      await worker.terminate().catch(() => undefined);
      workerQueue.release();
      resolve({
        ...response,
        logs: response.logs ?? [],
        timeline: response.timeline ?? [],
        durationMs: Math.round(performance.now() - startedAt),
        timedOut,
      });
    }

    worker.on('message', (message) => {
      if (settled) return;
      if (message && message.type === 'child-processes') {
        const existing = workerResources.get(worker) ?? { pids: new Set(), tempDir: undefined };
        for (const pid of message.pids) {
          existing.pids.add(pid);
        }
        if (message.tempDir !== undefined) {
          existing.tempDir = message.tempDir;
        }
        workerResources.set(worker, existing);
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
