import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestQueue } from './requestQueue.mjs';

test('RequestQueue', async (t) => {
  await t.test('does not exceed max concurrency with immediate release', async () => {
    const q = new RequestQueue(2);
    const promises = [];

    for (let i = 0; i < 4; i++) {
      promises.push(
        q.acquire().then(() => {
          assert.ok(q.active <= 2, `active (${q.active}) should not exceed concurrency (2)`);
          q.release();
        })
      );
    }

    await Promise.all(promises);
    assert.strictEqual(q.active, 0, 'all slots should be released');
  });

  await t.test('queues requests when at capacity', async () => {
    const q = new RequestQueue(1);
    let secondAcquired = false;

    await q.acquire();
    assert.strictEqual(q.active, 1);

    const second = q.acquire().then(() => {
      secondAcquired = true;
    });

    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(secondAcquired, false, 'second acquire should be queued');

    q.release();
    await second;
    assert.strictEqual(secondAcquired, true, 'second acquire should proceed after release');
    assert.strictEqual(q.active, 1);

    q.release();
    assert.strictEqual(q.active, 0);
  });

  await t.test('slot remains occupied while release is deferred', async () => {
    const q = new RequestQueue(1);
    await q.acquire();
    assert.strictEqual(q.active, 1);

    let releaseCalled = false;
    const deferredRelease = new Promise((resolve) => {
      setTimeout(() => {
        releaseCalled = true;
        q.release();
        resolve();
      }, 50);
    });

    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(releaseCalled, false, 'release should not have been called yet');
    assert.strictEqual(q.active, 1, 'slot should still be occupied');

    await deferredRelease;
    assert.strictEqual(releaseCalled, true);
    assert.strictEqual(q.active, 0, 'slot should be free after deferred release');
  });

  await t.test('concurrent acquire/release cycle never exceeds concurrency', async () => {
    const CONCURRENCY = 3;
    const TOTAL = 10;
    const q = new RequestQueue(CONCURRENCY);
    let peakActive = 0;

    const promises = Array.from({ length: TOTAL }, () =>
      q.acquire().then(() => {
        peakActive = Math.max(peakActive, q.active);
        return new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
      }).then(() => {
        q.release();
      })
    );

    await Promise.all(promises);
    assert.ok(peakActive <= CONCURRENCY, `peak active (${peakActive}) should not exceed concurrency (${CONCURRENCY})`);
    assert.strictEqual(q.active, 0, 'all slots released');
  });

  await t.test('release after terminate pattern: slot stays occupied until terminate resolves', async () => {
    const q = new RequestQueue(1);
    await q.acquire();
    assert.strictEqual(q.active, 1);

    let releaseCalled = false;
    const terminatePromise = new Promise((resolve) => {
      setTimeout(() => resolve(undefined), 40);
    });

    terminatePromise
      .catch(() => undefined)
      .finally(() => {
        releaseCalled = true;
        q.release();
      });

    await new Promise((r) => setTimeout(r, 10));
    assert.strictEqual(q.active, 1, 'slot must remain occupied during terminate');
    assert.strictEqual(releaseCalled, false, 'release must not be called before terminate resolves');

    await terminatePromise;
    await new Promise((r) => setTimeout(r, 5));
    assert.strictEqual(releaseCalled, true, 'release should be called after terminate resolves');
    assert.strictEqual(q.active, 0, 'slot should be freed');
  });

  await t.test('rejects when queue is full', async () => {
    const q = new RequestQueue(1, 1);
    await q.acquire();

    await assert.rejects(q.acquire(), /Server is busy/);

    q.release();
    assert.strictEqual(q.active, 0);
  });
});
