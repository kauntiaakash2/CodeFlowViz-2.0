import test from 'node:test';
import assert from 'node:assert/strict';
import { instrumentCode } from './javaInstrumenter.mjs';

test('Java instrumentation handles representative assignments and loops', () => {
  const source = `
class Example {
  void run() {
    int x = 0;
    while (x < 3) x++;
    for (int i = 0; i < 2; i++) {
      x += i;
    }
  }
}
`;

  const { code, hookCount } = instrumentCode(source);
  assert.equal(hookCount, 5);
  assert.match(code, /_Trace\.capture\([^)]*"loop-iteration"\)/);
  assert.equal((code.match(/_Trace\.capture/g) ?? []).length, hookCount);
});

test('Java blockless loop keeps its trace inside generated braces', () => {
  const source = 'class Example { void run() { int x = 0; while (x < 1) x++; } }';
  const { code } = instrumentCode(source);

  assert.match(
    code,
    /while \(x < 1\) \{\s*_Trace\.capture\([^)]*"loop-iteration"\);[\s\S]*x\+\+[\s\S]*_Trace\.capture\([^)]*"assignment"\);[\s;]*\}/,
  );
});

test('Java instrumentation enforces the 1000-hook limit', () => {
  const declarations = Array.from({ length: 1200 }, (_, index) => `int value${index} = ${index};`).join('\n');
  const source = `class Example { void run() { ${declarations} } }`;
  const { code, hookCount } = instrumentCode(source);

  assert.equal(hookCount, 1000);
  assert.equal((code.match(/_Trace\.capture/g) ?? []).length, 1000);
});

test('Java iterative traversal handles deeply nested blocks', () => {
  const depth = 2000;
  const source = `class Example { void run() { ${'{'.repeat(depth)} int value = 1; ${'}'.repeat(depth)} } }`;

  assert.doesNotThrow(() => instrumentCode(source));
});
