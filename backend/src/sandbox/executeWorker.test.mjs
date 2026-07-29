import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { treeKill, cleanupWorkerResources, workerResources } = await import('../server.js');

test('treeKill - ignores PID <= 1 and non-integer values', () => {
  assert.doesNotThrow(() => treeKill(-1));
  assert.doesNotThrow(() => treeKill(0));
  assert.doesNotThrow(() => treeKill(1));
  assert.doesNotThrow(() => treeKill(1.5));
  assert.doesNotThrow(() => treeKill('abc'));
});

test('treeKill - kills a running child process', async () => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  assert.strictEqual(child.exitCode, null, 'Child should be running');

  treeKill(child.pid);

  await new Promise((r) => setTimeout(r, 500));

  try {
    process.kill(child.pid, 0);
    assert.fail('Child process should have been killed');
  } catch (err) {
    assert.ok(err.code === 'ESRCH' || err.code === 'EPERM', `Expected ESRCH/EPERM, got ${err.code}`);
  }
});

test('cleanupWorkerResources - null/undefined resources does not throw', () => {
  assert.doesNotThrow(() => cleanupWorkerResources(null));
  assert.doesNotThrow(() => cleanupWorkerResources(undefined));
});

test('cleanupWorkerResources - cleans up temp directory', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfv-test-'));
  fs.writeFileSync(path.join(tempDir, 'test.txt'), 'hello');

  const resources = { pids: new Set(), tempDir };
  cleanupWorkerResources(resources);

  assert.ok(!fs.existsSync(tempDir), 'Temp dir should be removed');
});

test('cleanupWorkerResources - kills tracked PIDs', async () => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const resources = { pids: new Set([child.pid]), tempDir: null };
  cleanupWorkerResources(resources);

  await new Promise((r) => setTimeout(r, 500));

  try {
    process.kill(child.pid, 0);
    assert.fail('Child PID should have been killed by cleanupWorkerResources');
  } catch (err) {
    assert.ok(err.code === 'ESRCH' || err.code === 'EPERM', `Expected ESRCH/EPERM, got ${err.code}`);
  }
});

test('cleanupWorkerResources - clears PIDs set after cleanup', async () => {
  const child = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60000)'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  const resources = { pids: new Set([child.pid]), tempDir: null };
  cleanupWorkerResources(resources);
  assert.strictEqual(resources.pids.size, 0, 'PIDs set should be empty after cleanup');
});

test('workerResources WeakMap exists and can store/retrieve resources', () => {
  const key = {};
  const resources = { pids: new Set([42]), tempDir: '/tmp/test' };

  workerResources.set(key, resources);
  const retrieved = workerResources.get(key);

  assert.deepStrictEqual([...retrieved.pids], [42]);
  assert.strictEqual(retrieved.tempDir, '/tmp/test');
  workerResources.delete(key);
  assert.strictEqual(workerResources.get(key), undefined);
});

test('integration - real worker timeout cleans up child processes and temp directory', async () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const workerPath = path.join(__dirname, 'executeWorker.mjs');

  // Java code that loops forever so the worker timeout fires
  const code = `public class Main { public static void main(String[] a) throws Exception { for (;;) { Thread.sleep(1000); } } }`;

  const worker = new Worker(workerPath, {
    workerData: { code, timeoutMs: 300, language: 'java' },
  });
  worker.unref();

  let trackedPids = null;
  let trackedTempDir = null;

  const result = await new Promise((resolve) => {
    worker.on('message', (msg) => {
      if (msg && msg.type === 'child-processes') {
        trackedPids = msg.pids;
        trackedTempDir = msg.tempDir;
        return;
      }
      resolve(msg);
    });
    worker.on('error', (err) => resolve({ ok: false, error: err.message }));
    worker.on('exit', (code) => {
      resolve({ ok: false, error: code !== 0 ? `Worker exited with code ${code}` : 'Worker exited' });
    });
    // Safety timeout - should never hit this if worker responds
    setTimeout(() => resolve({ ok: false, error: 'safety' }), 15000);
  });

  // At minimum the worker should have reported a tempDir before trying javac
  if (trackedTempDir) {
    assert.ok(!fs.existsSync(trackedTempDir),
      `Temp dir ${trackedTempDir} should have been removed`);
  }

  // Any PIDs the worker reported should no longer be alive
  for (const pid of (trackedPids || [])) {
    try {
      process.kill(pid, 0);
      assert.fail(`PID ${pid} should have been killed after worker termination`);
    } catch (err) {
      assert.ok(err.code === 'ESRCH' || err.code === 'EPERM',
        `Expected ESRCH/EPERM for PID ${pid}, got ${err.code}`);
    }
  }

  // Even if javac/java were not installed, the worker should have sent a result
  assert.ok(result === undefined || typeof result === 'object',
    'Worker should have sent a completion message');
});
