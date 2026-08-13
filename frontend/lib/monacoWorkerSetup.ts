import { loader } from '@monaco-editor/react';

export type WorkerSetupStatus = 'workers' | 'fallback';

type StatusListener = (status: WorkerSetupStatus) => void;

let status: WorkerSetupStatus = 'workers';
const statusListeners = new Set<StatusListener>();

function setWorkerStatus(nextStatus: WorkerSetupStatus) {
  if (status === nextStatus) return;
  status = nextStatus;
  for (const listener of statusListeners) {
    listener(status);
  }
}

export function getWorkerStatus(): WorkerSetupStatus {
  return status;
}

export function subscribeWorkerStatus(listener: StatusListener) {
  statusListeners.add(listener);
  listener(status);
  return () => {
    statusListeners.delete(listener);
  };
}

export async function initializeMonaco() {
  try {
    const instance = await loader.init();
    setWorkerStatus('workers');
    return instance;
  } catch (error) {
    setWorkerStatus('fallback');
    throw error;
  }
}

// The predev/prebuild script copies this exact npm distribution to public.
// Keeping the loader and its workers under one origin avoids both CSP failures
// and CDN code replacing a custom MonacoEnvironment.
loader.config({
  paths: {
    vs: '/monaco/vs',
  },
});

if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const source = event.filename ?? '';
    const message = event.message ?? '';
    if (
      source.includes('/monaco/vs/') ||
      /monaco.*worker|worker.*monaco/i.test(message)
    ) {
      setWorkerStatus('fallback');
    }
  });
}
