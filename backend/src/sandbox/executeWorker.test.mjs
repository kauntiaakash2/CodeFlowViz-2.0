import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { processExists } from './processTreeKill.mjs';

const server = await import('../server.js');
const { treeKill, cleanupWorkerResources, workerResources } = server;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnLongRunningChild() {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 60000)'], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
  return child;
}

function assertProcessGone(pid) {
  try {
    process.kill(pid, 0);
    assert.fail(`PID ${pid} should have been killed`);
  } catch (err) {
    assert.ok(
      err.code === 'ESRCH' || err.code === 'EPERM',
      `Expected ESRCH/EPERM for PID ${pid}, got ${err.code}`
    );
  }
}

test('treeKill - ignores PID <= 1 and non-integer values', async () => {
  for (const pid of [-1, 0, 1, 1.5, 'abc', undefined, null]) {
    await assert.doesNotReject(() => treeKill(pid));
  }
});

test('treeKill - kills a running child process', async () => {
  const child = spawnLongRunningChild();
  assert.strictEqual(child.exitCode, null, 'Child should be running');

  await treeKill(child.pid);

  assertProcessGone(child.pid);
});

test('cleanupWorkerResources - null/undefined resources does not throw', async () => {
  await assert.doesNotReject(() => cleanupWorkerResources(null));
  await assert.doesNotReject(() => cleanupWorkerResources(undefined));
});

test('cleanupWorkerResources - cleans up temp directory', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfv-test-'));
  fs.writeFileSync(path.join(tempDir, 'test.txt'), 'hello');

  await cleanupWorkerResources({ pids: new Set(), tempDir });

  assert.ok(!fs.existsSync(tempDir), 'Temp dir should be removed');
});

test('cleanupWorkerResources - kills tracked PIDs', async () => {
  const child = spawnLongRunningChild();

  await cleanupWorkerResources({ pids: new Set([child.pid]), tempDir: null });

  assertProcessGone(child.pid);
});

test('cleanupWorkerResources - clears PIDs set after cleanup', async () => {
  const child = spawnLongRunningChild();

  const resources = { pids: new Set([child.pid]), tempDir: null };
  await cleanupWorkerResources(resources);

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

test('integration - parent timeout confirms detached process group and temp dir are gone', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfv-fixture-'));
  const javacPidFile = path.join(fixtureDir, 'javac.pid');
  const javaPidFile = path.join(fixtureDir, 'java.pid');

  function fixtureScript(pidFile) {
    return [
      "import fs from 'node:fs';",
      `fs.writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));`,
      'console.log(process.pid);',
      'setInterval(() => {}, 100000);',
      '',
    ].join('\n');
  }

  const javacFixture = path.join(fixtureDir, 'javac.mjs');
  const javaFixture = path.join(fixtureDir, 'java.mjs');
  fs.writeFileSync(javacFixture, fixtureScript(javacPidFile));
  fs.writeFileSync(javaFixture, fixtureScript(javaPidFile));

  const originalJavacCmd = process.env.CFV_JAVAC_CMD;
  const originalJavaCmd = process.env.CFV_JAVA_CMD;
  process.env.CFV_JAVAC_CMD = JSON.stringify([process.execPath, javacFixture]);
  process.env.CFV_JAVA_CMD = JSON.stringify([process.execPath, javaFixture]);

  const tmpRoot = fs.realpathSync(os.tmpdir());
  const before = new Set(fs.readdirSync(tmpRoot).filter((n) => n.startsWith('codeflowviz-')));

  let result;
  let javacPid;
  let javaSpawned;
  try {
    result = await server.runInSandbox('public class Main { public static void main(String[] a) {} }', 500, 'java');
    javacPid = Number(fs.readFileSync(javacPidFile, 'utf8'));
    javaSpawned = fs.existsSync(javaPidFile);
  } finally {
    if (originalJavacCmd === undefined) delete process.env.CFV_JAVAC_CMD;
    else process.env.CFV_JAVAC_CMD = originalJavacCmd;
    if (originalJavaCmd === undefined) delete process.env.CFV_JAVA_CMD;
    else process.env.CFV_JAVA_CMD = originalJavaCmd;
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  }

  assert.strictEqual(result.timedOut, true, `Expected timedOut=true, got: ${JSON.stringify(result)}`);
  assert.ok(result.error && result.error.includes('timed out'), `Expected timeout error, got: ${result.error}`);

  assert.ok(Number.isInteger(javacPid) && javacPid > 1, 'Fixture javac should have reported its PID');
  assert.strictEqual(javaSpawned, false, 'java fixture should not run while javac hangs');

  assertProcessGone(javacPid);

  const after = fs.readdirSync(tmpRoot).filter((n) => n.startsWith('codeflowviz-'));
  const leftovers = after.filter((n) => !before.has(n));
  assert.deepStrictEqual(leftovers, [], `Temp dirs should be removed after worker termination`);
});

test('processExists - treats a live process as existing', () => {
  mock.method(process, 'kill', () => {});
  try {
    assert.strictEqual(processExists(4242), true);
  } finally {
    mock.restoreAll();
  }
});

test('processExists - treats ESRCH as gone', () => {
  const err = new Error('ESRCH');
  err.code = 'ESRCH';
  mock.method(process, 'kill', () => { throw err; });
  try {
    assert.strictEqual(processExists(4242), false);
  } finally {
    mock.restoreAll();
  }
});

test('processExists - treats EPERM as existing but unsignallable', () => {
  const err = new Error('EPERM');
  err.code = 'EPERM';
  mock.method(process, 'kill', () => { throw err; });
  try {
    assert.strictEqual(processExists(4242), true);
  } finally {
    mock.restoreAll();
  }
});

test('cleanupWorkerResources - retains PIDs whose termination is not confirmed', async () => {
  const resources = { pids: new Set([1]), tempDir: null };
  const unconfirmed = await cleanupWorkerResources(resources);

  assert.deepStrictEqual(unconfirmed, [1], 'Unconfirmed PID should be reported for retry/diagnostics');
  assert.deepStrictEqual([...resources.pids], [1], 'Unconfirmed PID should be retained for retry');
});

const FAKE_WORKER_SOURCE = `
import { parentPort } from 'node:worker_threads';
import { spawn } from 'node:child_process';
import fs from 'node:fs';

function hangChild() {
  const child = spawn(process.execPath, ['-e', "process.on('SIGTERM', function(){}); setInterval(function(){}, 60000)"], {
    detached: true,
    stdio: 'ignore',
  });
  child.on('error', () => {});
  child.unref();
  return child;
}

const pidFile = process.env.CFV_PID_FILE;
const goFile = process.env.CFV_GO_FILE;

const child1 = hangChild();
fs.appendFileSync(pidFile, String(child1.pid) + '\\n');
parentPort.postMessage({ type: 'child-processes', pids: [child1.pid], tempDir: undefined });

const poll = setInterval(() => {
  if (fs.existsSync(goFile)) {
    clearInterval(poll);
    const child2 = hangChild();
    fs.appendFileSync(pidFile, String(child2.pid) + '\\n');
    parentPort.postMessage({ type: 'child-processes', pids: [child1.pid, child2.pid], tempDir: undefined });
  }
}, 2);

setInterval(function(){}, 60000);
`;

test('regression - timed-out worker cannot orphan children spawned during teardown', async () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfv-latespawn-'));
  const fakeWorkerPath = path.join(fixtureDir, 'lateSpawnWorker.mjs');
  const pidFile = path.join(fixtureDir, 'pids.txt');
  const goFile = path.join(fixtureDir, 'go.signal');
  fs.writeFileSync(fakeWorkerPath, FAKE_WORKER_SOURCE);

  const originalWorkerPath = process.env.CFV_WORKER_PATH;
  const originalPidFile = process.env.CFV_PID_FILE;
  const originalGoFile = process.env.CFV_GO_FILE;
  process.env.CFV_WORKER_PATH = fakeWorkerPath;
  process.env.CFV_PID_FILE = pidFile;
  process.env.CFV_GO_FILE = goFile;

  let result;
  const goTimer = setTimeout(() => {
    try {
      fs.writeFileSync(goFile, 'go');
    } catch {}
  }, 425);

  try {
    result = await server.runInSandbox('ignored', 300, 'javascript');
  } finally {
    clearTimeout(goTimer);
    if (originalWorkerPath === undefined) delete process.env.CFV_WORKER_PATH;
    else process.env.CFV_WORKER_PATH = originalWorkerPath;
    if (originalPidFile === undefined) delete process.env.CFV_PID_FILE;
    else process.env.CFV_PID_FILE = originalPidFile;
    if (originalGoFile === undefined) delete process.env.CFV_GO_FILE;
    else process.env.CFV_GO_FILE = originalGoFile;
  }

  assert.strictEqual(result.timedOut, true, `Expected timed-out run, got: ${JSON.stringify(result)}`);

  const pids = fs.existsSync(pidFile)
    ? fs.readFileSync(pidFile, 'utf8').trim().split('\n').filter(Boolean).map(Number)
    : [];
  assert.ok(pids.length >= 1, 'Worker should have recorded at least one child PID before the timeout');
  for (const pid of pids) {
    assert.ok(Number.isInteger(pid) && pid > 1, `Recorded PID must be valid, got: ${pid}`);
    assertProcessGone(pid);
  }

  fs.rmSync(fixtureDir, { recursive: true, force: true });
});
