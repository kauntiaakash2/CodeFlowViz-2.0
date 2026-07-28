import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const { treeKill, cleanupWorkerResources, workerResources } = await import('../server.js');

test('treeKill - handles valid and invalid PIDs without throwing', () => {
  assert.doesNotThrow(() => treeKill(-1));
  assert.doesNotThrow(() => treeKill(999999999));
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

test('cleanupWorkerResources - clears PIDs set after cleanup', () => {
  const resources = { pids: new Set([123, 456]), tempDir: null };
  cleanupWorkerResources(resources);
  assert.strictEqual(resources.pids.size, 0, 'PIDs set should be empty after cleanup');
});

test('workerResources WeakMap exists and can store/retrieve resources', () => {
  const key = {};
  const resources = { pids: new Set([1, 2, 3]), tempDir: '/tmp/test' };

  workerResources.set(key, resources);
  const retrieved = workerResources.get(key);

  assert.deepStrictEqual([...retrieved.pids], [1, 2, 3]);
  assert.strictEqual(retrieved.tempDir, '/tmp/test');
  workerResources.delete(key);
  assert.strictEqual(workerResources.get(key), undefined);
});
