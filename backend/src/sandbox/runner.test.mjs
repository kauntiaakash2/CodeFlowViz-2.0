import test from 'node:test';
import assert from 'node:assert/strict';
import { runInSandbox } from './runner.mjs';
import { instrumentCode } from '../tracing/instrument.mjs';

test('Sandbox Security & Execution Suite', async (t) => {
  await t.test('handles basic execution successfully', async () => {
    const code = `
      let x = 10;
      let y = 20;
      x + y;
    `;
    const result = await runInSandbox(code, 1000);
    assert.strictEqual(result.ok, true, 'Execution should succeed');
    assert.strictEqual(result.result.value, '30', 'Should return the evaluated result');
  });

  await t.test('stops infinite synchronous loops (timeout)', async () => {
    const code = `
      while (true) {}
    `;
    const result = await runInSandbox(code, 300);
    assert.strictEqual(result.ok, false, 'Execution should fail due to timeout');
    assert.ok(
      result.error.includes('timed out') || result.error.includes('exited with code'),
      'Error message should indicate timeout or forced exit'
    );
  });

  await t.test('prevents async loops from hanging the backend', async () => {
    const code = `
      async function loop() {
        while(true) {
          await new Promise(r => setTimeout(r, 0));
        }
      }
      loop();
    `;
    // vm.runInContext returns the Promise immediately, and the backend releases the worker safely.
    const result = await runInSandbox(code, 300);
    assert.strictEqual(result.ok, true, 'Execution succeeds synchronously returning a Promise');
    assert.ok(result.result.value.includes('Promise'), 'Returns a pending promise');
  });

  await t.test('prevents sandbox escape via console constructor (Function constructor bypass)', async () => {
    const code = `
      let result;
      try {
        const fn = console.log.constructor('return process')();
        result = fn ? 'escaped' : 'no process';
      } catch (e) {
        result = 'blocked: ' + e.message;
      }
      result;
    `;
    const result = await runInSandbox(code, 1000);
    assert.strictEqual(result.ok, true, 'Execution should succeed');
    assert.ok(
      result.result.value.includes('blocked') || result.result.value.includes('process is not defined'),
      'Should block access to process through host constructor'
    );
  });

  await t.test('prevents sandbox escape via dynamic import', async () => {
    assert.throws(
      () => instrumentCode("import('node:fs')"),
      (error) => error?.name === 'SyntaxError'
        && /dynamic import\(\) is not supported in script mode/i.test(error.message),
      'Dynamic import must be rejected before untrusted code reaches the VM'
    );
  });

  await t.test('prevents sandbox escape via __trace constructor', async () => {
    const code = `
      let result;
      try {
        const fn = __trace.capture.constructor('return process')();
        result = fn ? 'escaped' : 'no process';
      } catch (e) {
        result = 'blocked: ' + e.message;
      }
      result;
    `;
    const result = await runInSandbox(code, 1000);
    assert.strictEqual(result.ok, true, 'Execution should succeed');
    assert.ok(
      result.result.value.includes('blocked') || result.result.value.includes('process is not defined'),
      'Should block access to process through host trace constructor'
    );
  });

  await t.test('prevents access to Node.js core modules (isolation)', async () => {
    const code = `
      const fs = require('fs');
      fs.readFileSync('/etc/passwd');
    `;
    const result = await runInSandbox(code, 1000);
    assert.strictEqual(result.ok, false, 'Execution should fail');
    assert.ok(
      result.error.includes('require is not defined') || result.error.includes('is not defined'),
      'Require should be undefined in sandbox'
    );
  });

  await t.test('prevents access to process and process.exit (isolation)', async () => {
    const code = `
      process.exit(1);
    `;
    const result = await runInSandbox(code, 1000);
    assert.strictEqual(result.ok, false, 'Execution should fail');
    assert.ok(result.error.includes('process is not defined'), 'process should be undefined');
  });

  await t.test('handles resource exhaustion (memory limit hit)', async () => {
    const code = `
      const arr = [];
      while(true) {
        arr.push(new Array(1000000).fill('exhaustion'));
      }
    `;
    const result = await runInSandbox(code, 1000);
    assert.strictEqual(result.ok, false, 'Execution should fail');
    assert.ok(
      result.error.includes('exited with code') ||
      result.error.includes('timed out') ||
      result.error.includes('memory') ||
      result.error.includes('allocation failed'),
      'Should fail due to crash or timeout'
    );
  });

  await t.test('safely handles unhandled promise rejections', async () => {
    const code = `
      new Promise((_, reject) => reject(new Error("Bypass attempt")));
    `;
    const result = await runInSandbox(code, 500);
    // Returns the rejected promise safely without crashing the backend
    assert.strictEqual(result.ok, true, 'Execution finishes, returning the Promise');
    assert.ok(
      result.result.value.includes('<rejected>') || result.result.value.includes('Promise'),
      'Should safely serialize the rejected promise'
    );
  });

  await t.test('prevents hanging promises from blocking worker permanently', async () => {
    const code = `
      new Promise(() => {}); // never resolves
    `;
    const result = await runInSandbox(code, 300);
    assert.strictEqual(result.ok, true, 'Execution finishes, returning the pending Promise');
    assert.ok(result.result.value.includes('Promise { <pending> }'), 'Safely returns pending promise');
  });

  await t.test('catches syntax errors gracefully without crashing process', async () => {
    const code = `
      let x = ;
    `;
    const result = await runInSandbox(code, 500);
    assert.strictEqual(result.ok, false, 'Execution should fail due to syntax error');
    assert.ok(
      result.error.includes('SyntaxError') || result.error.includes('Unexpected token'),
      'Syntax error should be caught'
    );
  });
});
