/**
 * Monaco Editor Web Worker Setup
 *
 * Configures `MonacoEnvironment.getWorker` so that Monaco's language services
 * run in dedicated Worker threads rather than on the main UI thread, while
 * degrading gracefully when workers cannot be loaded.
 *
 * Strategy
 * --------
 * @monaco-editor/react loads Monaco from a CDN by default.  The CDN build
 * already ships the worker blobs; we just need to install a `getWorker`
 * factory on `window.MonacoEnvironment` *before* Monaco initialises so that
 * it uses our factory instead of its built-in one.
 *
 * The factory tries to construct a `Worker` from the CDN blob URL that Monaco
 * passes in.  If the browser rejects the construction (e.g. due to a strict
 * Content Security Policy, an extension, or a network issue) we catch the
 * error, flip the status flag to `'fallback'`, and let Monaco run on the main
 * thread.  All editing and execution features remain fully functional in that
 * degraded state — only IntelliSense / diagnostics are affected.
 *
 * This file must be imported as a side-effect (no tree-shaking) in any
 * client component that renders the Monaco Editor so the environment is set
 * up before `beforeMount` fires.  It is a no-op during SSR.
 */

'use strict';

/** Status reported back to the consumer after the first worker attempt. */
export type WorkerSetupStatus = 'workers' | 'fallback';

/** Internal mutable status — starts optimistic, downgraded on first failure. */
let status: WorkerSetupStatus = 'workers';

/**
 * Returns the current worker initialisation status.
 * Call this inside a `useEffect` (after mount) to read the final value.
 */
export function getWorkerStatus(): WorkerSetupStatus {
  return status;
}

// ── SSR guard ─────────────────────────────────────────────────────────────────
if (typeof window === 'undefined') {
  // Running on the Node.js server: nothing to configure.
} else {
  function tryCreateWorker(moduleId: string, label: string): Worker | Promise<Worker> {
    try {
      const worker = new Worker(moduleId, { name: `monaco-${label}-worker` });
      return worker;
    } catch (err) {
      if (status !== 'fallback') {
        status = 'fallback';
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            '[CodeFlowViz] Monaco web worker failed to initialise ' +
            `(label="${label}"). Falling back to main-thread mode. ` +
            'The editor stays fully functional but IntelliSense and ' +
            'real-time diagnostics are unavailable.\n',
            err,
          );
        }
      }
      return Promise.reject(err);
    }
  }

  (window as typeof window & {
    MonacoEnvironment?: {
      getWorker?: (moduleId: string, label: string) => Worker | Promise<Worker>;
    }
  }).MonacoEnvironment = {
    getWorker(moduleId: string, label: string): Worker | Promise<Worker> {
      return tryCreateWorker(moduleId, label);
    },
  };
}
