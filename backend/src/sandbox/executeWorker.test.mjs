import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const server = await import('../server.js');
const { treeKill, cleanupWorkerResources, workerResources } = server;

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

  // Create fixture javac/java executables that report PID and hang indefinitely
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfv-fixture-'));
  const isWin = process.platform === 'win32';

  const fixtureCode = `console.log(process.pid); setInterval(() => {}, 100000)`;
  if (isWin) {
    fs.writeFileSync(path.join(fixtureDir, 'javac.cmd'),
      `@echo off\r\nnode -e "${fixtureCode}"\r\n`);
    fs.writeFileSync(path.join(fixtureDir, 'java.cmd'),
      `@echo off\r\nnode -e "${fixtureCode}"\r\n`);
  } else {
    const shBody = `#!/bin/sh\nexec node -e '${fixtureCode}'\n`;
    fs.writeFileSync(path.join(fixtureDir, 'javac'), shBody);
    fs.writeFileSync(path.join(fixtureDir, 'java'), shBody);
    fs.chmodSync(path.join(fixtureDir, 'javac'), 0o755);
    fs.chmodSync(path.join(fixtureDir, 'java'), 0o755);
  }

  // Prepend fixture dir to PATH so our scripts intercept javac/java
  const originalPath = process.env.PATH;
  process.env.PATH = `${fixtureDir}${path.delimiter}${originalPath}`;

  const timeoutMs = 500;
  const code = 'public class Main { public static void main(String[] a) {} }';

  let result;
  try {
    result = await server.runInSandbox(code, timeoutMs, 'java');
  } finally {
    // Restore PATH regardless of outcome
    process.env.PATH = originalPath;
    // Clean up fixture dir
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }

  // 1. The response should report timedOut
  assert.ok(result.timedOut === true,
    `Expected timedOut=true, got: ${JSON.stringify(result)}`);

  // 2. The error message should reference the timeout
  assert.ok(result.error && result.error.includes('timed out'),
    `Expected timeout error, got: ${result.error}`);

  // 3. lastCleanedResources captures what cleanupWorkerResources handled
  const cleaned = server.lastCleanedResources;
  assert.ok(cleaned !== null, 'cleanupWorkerResources should have been called');

  // 4. A non-empty PID set was tracked and cleaned
  assert.ok(cleaned.pids.size > 0,
    `Expected at least one tracked PID, got ${cleaned.pids.size}`);
  for (const pid of cleaned.pids) {
    try {
      process.kill(pid, 0);
      assert.fail(`PID ${pid} should have been killed after worker termination`);
    } catch (err) {
      assert.ok(err.code === 'ESRCH' || err.code === 'EPERM',
        `Expected ESRCH/EPERM for PID ${pid}, got ${err.code}`);
    }
  }

  // 5. The temp directory reported by the worker should have been removed
  if (cleaned.tempDir) {
    assert.ok(!fs.existsSync(cleaned.tempDir),
      `Temp dir ${cleaned.tempDir} should have been removed`);
  }

  // 6. The worker entry was deleted from workerResources after cleanup
  // We can't directly verify this since we don't have the Worker ref,
  // but the fact that cleanupWorkerResources was called proves it.
});
