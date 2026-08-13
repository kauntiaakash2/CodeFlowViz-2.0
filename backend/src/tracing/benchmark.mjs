import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { instrumentCode } from './instrument.mjs';

if (typeof global.gc !== 'function') {
  console.error('Error: GC is not exposed. Please run node with the --expose-gc flag.');
  process.exit(1);
}

const statementCount = Number.parseInt(process.env.BENCHMARK_STATEMENTS ?? '10000', 10);
const iterations = Number.parseInt(process.env.BENCHMARK_ITERATIONS ?? '5', 10);

if (!Number.isInteger(statementCount) || statementCount < 1) {
  throw new TypeError('BENCHMARK_STATEMENTS must be a positive integer.');
}
if (!Number.isInteger(iterations) || iterations < 1) {
  throw new TypeError('BENCHMARK_ITERATIONS must be a positive integer.');
}

const source = Array.from({ length: statementCount }, (_, index) => `value${index} = ${index};`).join('\n');
const inserts = [];
let cursor = 0;
for (let index = 0; index < statementCount; index += 1) {
  const statement = `value${index} = ${index};`;
  cursor += statement.length;
  inserts.push({ index: cursor, text: `\n;trace(${index + 1});`, priority: 0 });
  cursor += 1;
}

function rebuildBaseline(input, pendingInserts) {
  return [...pendingInserts]
    .sort((a, b) => (b.index - a.index) || (a.priority - b.priority))
    .reduce(
      (nextSource, insert) => `${nextSource.slice(0, insert.index)}${insert.text}${nextSource.slice(insert.index)}`,
      input,
    );
}

function rebuildLinear(input, pendingInserts) {
  const sorted = [...pendingInserts].sort((a, b) => (a.index - b.index) || (b.priority - a.priority));
  const chunks = [];
  let lastIndex = 0;

  for (const insert of sorted) {
    if (insert.index > lastIndex) chunks.push(input.slice(lastIndex, insert.index));
    chunks.push(insert.text);
    lastIndex = insert.index;
  }
  chunks.push(input.slice(lastIndex));
  return chunks.join('');
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(rebuild) {
  const durations = [];
  const memoryDeltas = [];
  let result;

  for (let run = 0; run < iterations; run += 1) {
    global.gc();
    const memoryBefore = process.memoryUsage().heapUsed;
    const startedAt = performance.now();
    result = rebuild(source, inserts);
    durations.push(performance.now() - startedAt);
    global.gc();
    memoryDeltas.push(process.memoryUsage().heapUsed - memoryBefore);
  }

  return {
    result,
    durationMs: median(durations),
    memoryDeltaMb: median(memoryDeltas) / 1024 / 1024,
  };
}

const representative = instrumentCode('let value = 0; while (value < 3) value++;');
assert.ok(representative.hookCount > 0, 'Production instrumentation must still produce trace hooks.');

const baseline = measure(rebuildBaseline);
const optimized = measure(rebuildLinear);
assert.equal(optimized.result, baseline.result, 'Linear reconstruction must preserve exact output ordering.');

console.table([
  {
    reconstruction: 'baseline-reduce',
    durationMs: baseline.durationMs.toFixed(2),
    memoryDeltaMb: baseline.memoryDeltaMb.toFixed(2),
  },
  {
    reconstruction: 'linear-chunks',
    durationMs: optimized.durationMs.toFixed(2),
    memoryDeltaMb: optimized.memoryDeltaMb.toFixed(2),
  },
]);
console.log(`Workload: ${(source.length / 1024).toFixed(1)} KiB, ${statementCount} inserts, ${iterations} iterations`);
console.log(`Median reconstruction speedup: ${(baseline.durationMs / optimized.durationMs).toFixed(2)}x`);
