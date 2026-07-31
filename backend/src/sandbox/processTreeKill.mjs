import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const POLL_INTERVAL_MS = 50;
const SIGTERM_GRACE_POLLS = 6;
const SIGKILL_GRACE_POLLS = 20;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code !== 'ESRCH' && err.code !== 'EPERM';
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
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // process group already exited
  }
  if (await waitUntilGone(pid, groupExists, SIGTERM_GRACE_POLLS)) return true;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // process group already exited
  }
  return await waitUntilGone(pid, groupExists, SIGKILL_GRACE_POLLS);
}
