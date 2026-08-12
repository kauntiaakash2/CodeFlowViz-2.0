import test from 'node:test';
import assert from 'node:assert/strict';
import { logger, requestContext } from './logger.mjs';

test('Logger outputs JSON when NODE_ENV is not development', () => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  let loggedOutput = null;
  const originalLog = console.log;
  console.log = (output) => { loggedOutput = output; };

  try {
    logger.info('Test message', { foo: 'bar' });
    
    assert.ok(loggedOutput);
    const parsed = JSON.parse(loggedOutput);
    assert.equal(parsed.level, 'info');
    assert.equal(parsed.message, 'Test message');
    assert.deepEqual(parsed.context, { foo: 'bar' });
    assert.equal(parsed.requestId, null);
  } finally {
    console.log = originalLog;
    process.env.NODE_ENV = originalEnv;
  }
});

test('Logger injects requestId from AsyncLocalStorage', (t, done) => {
  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  let loggedOutput = null;
  const originalLog = console.log;
  console.log = (output) => { loggedOutput = output; };

  try {
    requestContext.run({ requestId: 'req-123' }, () => {
      logger.info('Inside context');
      
      const parsed = JSON.parse(loggedOutput);
      assert.equal(parsed.requestId, 'req-123');
      assert.equal(parsed.message, 'Inside context');
      done();
    });
  } finally {
    console.log = originalLog;
    process.env.NODE_ENV = originalEnv;
  }
});
