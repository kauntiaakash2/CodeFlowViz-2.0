import { instrumentCode } from './instrument.mjs';
import { performance } from 'node:perf_hooks';

// Ensure gc is exposed
if (typeof global.gc !== 'function') {
  console.error('Error: GC is not exposed. Please run node with the --expose-gc flag.');
  process.exit(1);
}

console.log('Generating test workload...');
// Generate a moderately large JavaScript source file (~25,000 lines) with lots of assignments
const lines = [];
for (let i = 0; i < 5000; i++) {
  lines.push(`function fn_${i}() {`);
  lines.push(`  let x = ${i};`);
  lines.push(`  x += 1;`);
  lines.push(`  if (x > 10) x = 0; else x = 5;`);
  lines.push(`  return x;`);
  lines.push(`}`);
}
const sourceCode = lines.join('\n');
console.log(`Generated workload size: ${(sourceCode.length / 1024 / 1024).toFixed(2)} MB (${lines.length} lines)`);

// Warmup
console.log('Warming up JIT...');
for (let i = 0; i < 5; i++) {
  instrumentCode('let a = 1; a = 2;');
}

// Benchmark
console.log('Running benchmark...');
global.gc();
const memBefore = process.memoryUsage().heapUsed;
const t0 = performance.now();

const result = instrumentCode(sourceCode);

const t1 = performance.now();
global.gc();
const memAfter = process.memoryUsage().heapUsed;

const timeTaken = t1 - t0;
const memoryUsed = memAfter - memBefore;

console.log('--------------------------------------');
console.log('Benchmark Results:');
console.log(`Hook Count:   ${result.hookCount}`);
console.log(`Time Taken:   ${timeTaken.toFixed(2)} ms`);
console.log(`Memory Delta: ${(memoryUsed / 1024 / 1024).toFixed(2)} MB`);
console.log('--------------------------------------');
