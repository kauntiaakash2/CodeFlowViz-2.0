import { parentPort, workerData } from 'node:worker_threads';
import vm from 'node:vm';
import { inspect, promisify } from 'node:util';
import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import { instrumentCode as instrumentJS } from '../tracing/instrument.mjs';
import { instrumentCode as instrumentJava } from '../tracing/javaInstrumenter.mjs';

const execAsync = promisify(exec);

const MAX_LOGS = 50;
const MAX_LOG_CHARS = 2_000;
const MAX_TRACE_EVENTS = 300;

function clip(value, max = MAX_LOG_CHARS) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function serialize(value) {
  if (typeof value === 'undefined') return { type: 'undefined', value: 'undefined' };
  if (typeof value === 'bigint') return { type: 'bigint', value: `${value.toString()}n` };
  if (typeof value === 'function') return { type: 'function', value: '[Function]' };

  try {
    return {
      type: Array.isArray(value) ? 'array' : typeof value,
      value: clip(inspect(value, { depth: 4, maxArrayLength: 50, breakLength: 100 })),
    };
  } catch {
    return { type: typeof value, value: '[Unserializable value]' };
  }
}

function createTrace(timeline) {
  return Object.freeze({
    capture(line, event, variables = {}) {
      if (timeline.length >= MAX_TRACE_EVENTS) return;
      const snapshot = {};
      for (const [name, value] of Object.entries(variables)) {
        snapshot[name] = serialize(value);
      }
      timeline.push({ step: timeline.length + 1, line, event, variables: snapshot });
    },
  });
}

function createConsole(logs) {
  const record = (level, args) => {
    if (logs.length >= MAX_LOGS) return;
    logs.push({ level, message: clip(args.map((arg) => serialize(arg).value).join(' ')) });
  };
  return Object.freeze({
    log: (...args) => record('log', args),
    info: (...args) => record('info', args),
    warn: (...args) => record('warn', args),
    error: (...args) => record('error', args),
  });
}

function runJavaScript(code, timeoutMs) {
  const logs = [];
  const timeline = [];
  const { code: instrumentedCode, hookCount } = instrumentJS(code);
  const sandbox = Object.create(null);

  Object.defineProperties(sandbox, {
    console: { value: createConsole(logs), enumerable: true },
    __trace: { value: createTrace(timeline), enumerable: false },
    globalThis: { value: sandbox, enumerable: false },
  });

  const context = vm.createContext(sandbox, { name: 'codeflowviz-sandbox' });
  const script = new vm.Script(`'use strict';\n${instrumentedCode}`, { filename: 'user-code.js' });
  
  const result = script.runInContext(context, { timeout: timeoutMs, breakOnSigint: false });
  return { ok: true, result: serialize(result), logs, timeline, instrumentation: { hookCount } };
}

async function runJava(code, timeoutMs) {
  const logs = [];
  const timeline = [];
  const { code: instrumentedCode, hookCount } = instrumentJava(code);

  const runId = crypto.randomUUID();
  const tempDir = path.join(os.tmpdir(), `codeflowviz-${runId}`);
  
  try {
    await fs.mkdir(tempDir, { recursive: true });

    // bridge class to catch our injected trace hooks
    const traceClassPath = path.join(tempDir, '_Trace.java');
    const traceClassCode = `
      public class _Trace {
        public static void capture(int line, String event) {
          System.out.println("___CFV_TRACE___:{\\"line\\":" + line + ",\\"event\\":\\"" + event + "\\"}");
        }
      }
    `;
    await fs.writeFile(traceClassPath, traceClassCode);

    // dump user code (assuming public class Main for now)
    const mainClassPath = path.join(tempDir, 'Main.java');
    await fs.writeFile(mainClassPath, instrumentedCode);

    await execAsync('javac Main.java _Trace.java', { cwd: tempDir, timeout: 5000 });
    const { stdout, stderr } = await execAsync('java Main', { cwd: tempDir, timeout: timeoutMs });

    const outputLines = stdout.split('\n');
    let stepCount = 1;

    for (const line of outputLines) {
      if (!line.trim()) continue;
      
      // filter trace json from standard sysout
      if (line.includes('___CFV_TRACE___:')) {
        if (timeline.length >= MAX_TRACE_EVENTS) continue;
        try {
          const jsonStr = line.split('___CFV_TRACE___:')[1];
          const parsed = JSON.parse(jsonStr);
          timeline.push({ step: stepCount++, line: parsed.line, event: parsed.event, variables: {} });
        } catch (e) {
          // swallow bad json
        }
      } else {
        if (logs.length < MAX_LOGS) {
          logs.push({ level: 'log', message: clip(line) });
        }
      }
    }

    if (stderr && logs.length < MAX_LOGS) {
       logs.push({ level: 'error', message: clip(stderr) });
    }

    return { ok: true, result: serialize("Execution completed"), logs, timeline, instrumentation: { hookCount } };

  } catch (error) {
    return { ok: false, error: error.message || 'Java execution failed', logs, timeline, instrumentation: { hookCount } };
  } finally {
    // cleanup temp dir so we don't nuke the server disk
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function run() {
  const { code, timeoutMs, language } = workerData;
  if (language === 'java') {
      return await runJava(code, timeoutMs);
  }
  return runJavaScript(code, timeoutMs);
}

run()
  .then(res => parentPort.postMessage(res))
  .catch(err => parentPort.postMessage({
    ok: false,
    error: err instanceof Error ? err.message : 'Unknown sandbox error',
    logs: [],
    timeline: [],
  }));
