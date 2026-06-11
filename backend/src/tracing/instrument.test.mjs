import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { instrumentCode } from './instrument.mjs';

test('instrumentCode - IfStatement regression tests', async (t) => {
  await t.test('wraps blockless if-else consequent and alternate in braces and traces correctly', () => {
    const code = `
let x = 0;
if (x === 0)
  x = 1;
else
  x = 2;
`;
    const { code: instrumented, hookCount } = instrumentCode(code);
    
    // Check that we have hooks
    assert.ok(hookCount > 0, 'Should have hooks instrumented');

    // Check that the code is wrapped in braces correctly
    assert.match(instrumented, /if\s*\(x === 0\)\s*\{\s*x = 1;/, 'Consequent should be wrapped in braces');
    assert.match(instrumented, /else\s*\{\s*x = 2;/, 'Alternate should be wrapped in braces');

    // Verify the instrumented code is syntactically valid and compiles
    assert.doesNotThrow(() => {
      new vm.Script(instrumented);
    }, 'Instrumented code should compile without SyntaxError');
  });

  await t.test('handles if-else with BlockStatement bodies normally', () => {
    const code = `
let x = 0;
if (x === 0) {
  x = 1;
} else {
  x = 2;
}
`;
    const { code: instrumented } = instrumentCode(code);

    assert.match(instrumented, /if\s*\(x === 0\)\s*\{\s*x = 1;/, 'Consequent should remain wrapped in braces');
    assert.match(instrumented, /else\s*\{\s*x = 2;/, 'Alternate should remain wrapped in braces');

    assert.doesNotThrow(() => {
      new vm.Script(instrumented);
    }, 'Instrumented code should compile without SyntaxError');
  });

  await t.test('handles loops without BlockStatement bodies by wrapping them in braces', () => {
    const code = `
let x = 0;
while (x < 5)
  x++;
`;
    const { code: instrumented } = instrumentCode(code);

    assert.match(instrumented, /while\s*\(x < 5\)\s*\{/, 'While loop body should be wrapped in braces');
    assert.doesNotThrow(() => {
      new vm.Script(instrumented);
    }, 'Instrumented loop should compile without SyntaxError');
  });
});
