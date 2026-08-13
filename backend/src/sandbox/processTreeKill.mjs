import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const POLL_INTERVAL_MS = 50;
const SIGTERM_GRACE_POLLS = 6;
const SIGKILL_GRACE_POLLS = 20;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readLinuxProcessStat(pid) {
  if (process.platform !== 'linux') return null;
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    return {
      state: fields[0],
      processGroupId: Number(fields[2]),
    };
  } catch {
    return null;
  }
}

export function processExists(pid) {
  const linuxStat = readLinuxProcessStat(pid);
  if (linuxStat?.state === 'Z') return false;

  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code !== 'ESRCH';
  }
}

function groupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (err) {
    return err.code !== 'ESRCH';
  }
}

function signalUnixTree(pid, signal) {
  // Detached children should be process-group leaders, but some container and
  // test environments do not expose that group consistently. Signal both the
  // group and its leader so an ESRCH group lookup cannot leave the child alive.
  try {
    process.kill(-pid, signal);
  } catch {
    // The process may not be a visible group leader in this environment.
  }
  try {
    process.kill(pid, signal);
  } catch {
    // The leader already exited.
  }
}

function unixTreeExists(pid) {
  return processExists(pid) || groupExists(pid);
}

async function waitUntilGone(pid, exists, maxPolls) {
  for (let attempt = 0; attempt < maxPolls; attempt += 1) {
    if (!exists(pid)) return true;
    await delay(POLL_INTERVAL_MS);
  }
  return !exists(pid);
}

export async function treeKill(pid) {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 1) return false;
  if (process.platform === 'win32') {
    try {
      await execFileAsync('taskkill', ['/F', '/T', '/PID', String(pid)], { windowsHide: true });
    } catch {
      // process already exited or cannot be signalled
    }
    return await waitUntilGone(pid, processExists, SIGKILL_GRACE_POLLS);
  }
  signalUnixTree(pid, 'SIGTERM');
  if (await waitUntilGone(pid, unixTreeExists, SIGTERM_GRACE_POLLS)) return true;
  signalUnixTree(pid, 'SIGKILL');
  return await waitUntilGone(pid, unixTreeExists, SIGKILL_GRACE_POLLS);
}
