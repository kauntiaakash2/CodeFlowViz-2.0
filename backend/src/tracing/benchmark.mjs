import { performance } from 'node:perf_hooks';
import { instrumentCode as oldInstrument } from './instrument.old.mjs';
import { instrumentCode as newInstrument } from './instrument.mjs';

function generateLargeJS(targetSizeKb) {
  let code = 'let x = 0;\n';
  let counter = 0;
  while (Buffer.byteLength(code, 'utf8') < targetSizeKb * 1024) {
    code += `function fn_${counter}() {\n  let a = ${counter};\n  let b = a + 1;\n  for (let i = 0; i < 2; i++) {\n    a = a + i;\n  }\n  return a;\n}\nfn_${counter}();\n`;
    counter++;
  }
  return code;
}

function runBenchmark(label, code, instrumentFunc) {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }

  const startMemory = process.memoryUsage().heapUsed;
  const startTime = performance.now();
  
  const result = instrumentFunc(code);
  
  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed;

  const durationMs = endTime - startTime;
  const memoryUsedMb = (endMemory - startMemory) / 1024 / 1024;

  return {
    durationMs: durationMs.toFixed(2),
    memoryMb: Math.max(0, memoryUsedMb).toFixed(2),
    hookCount: result.hookCount
  };
}

async function start() {
  console.log('Generating benchmark payloads...');
  const payloads = {
    '10KB': generateLargeJS(10),
    '100KB': generateLargeJS(100),
    '500KB': generateLargeJS(500)
  };

  console.log('Running benchmark suite...');
  const rows = [];

  for (const [size, code] of Object.entries(payloads)) {
    console.log(`Profiling ${size} payload...`);
    
    // Run old instrumenter
    const oldStats = runBenchmark('Old', code, oldInstrument);

    // Run new instrumenter
    const newStats = runBenchmark('New', code, newInstrument);

    rows.push({
      size,
      oldTime: oldStats.durationMs,
      newTime: newStats.durationMs,
      oldMem: oldStats.memoryMb,
      newMem: newStats.memoryMb,
      oldHooks: oldStats.hookCount,
      newHooks: newStats.hookCount
    });
  }

  console.log('\n================ BENCHMARK RESULTS ================');
  console.log('| Payload | Old Time (ms) | New Time (ms) | Old Heap (MB) | New Heap (MB) | Old Hooks | New Hooks |');
  console.log('|---------|---------------|---------------|---------------|---------------|-----------|-----------|');
  for (const row of rows) {
    console.log(
      `| ${row.size.padEnd(7)} | ${row.oldTime.padStart(13)} | ${row.newTime.padStart(13)} | ${row.oldMem.padStart(13)} | ${row.newMem.padStart(13)} | ${String(row.oldHooks).padStart(9)} | ${String(row.newHooks).padStart(9)} |`
    );
  }
  console.log('====================================================\n');
}

start().catch(console.error);
