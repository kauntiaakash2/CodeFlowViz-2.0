import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(__dirname, '../../data/sessions');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL

// Validates that sessionId is exactly the format emitted by save():
// 32 lowercase hex characters (128-bit / 16-byte crypto ID).
// Rejects any path-traversal attempts (e.g. "../../etc/passwd").
const SESSION_ID_RE = /^[0-9a-f]{32}$/;

export class SessionStore {
  static async init() {
    try {
      await fs.mkdir(SESSIONS_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create sessions directory:', error);
    }
  }

  static async save(sessionData) {
    await this.init();

    // 128-bit (16-byte) ID → 32 hex chars; collision probability negligible.
    let sessionId;
    let filePath;

    // Retry on the astronomically unlikely EEXIST collision.
    for (let attempt = 0; attempt < 3; attempt++) {
      sessionId = crypto.randomBytes(16).toString('hex');
      filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);

      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);

      const payload = {
        id: sessionId,
        ...sessionData,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };

      try {
        // 'wx' flag = fail if the file already exists — prevents overwriting a live trace.
        await fs.writeFile(filePath, JSON.stringify(payload, null, 2), { encoding: 'utf-8', flag: 'wx' });
        return payload;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        // On collision, loop and generate a new ID.
      }
    }

    throw new Error('Failed to generate a unique session ID after 3 attempts.');
  }

  static async get(sessionId) {
    // Reject any ID that doesn't match the exact format we generate.
    // This prevents path traversal attacks (e.g. "../../package").
    if (!SESSION_ID_RE.test(sessionId)) {
      return null;
    }

    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const session = JSON.parse(content);

      // Check TTL
      if (new Date() > new Date(session.expiresAt)) {
        await this.delete(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      // ENOENT = file doesn't exist → session not found, return null.
      // Corrupt JSON → treat as missing session, return null.
      // Any other error (EACCES, EIO, etc.) → operational failure, rethrow
      // so the caller returns a 500 instead of a misleading 404.
      if (error.code === 'ENOENT' || error instanceof SyntaxError) {
        return null;
      }
      throw error;
    }
  }

  static async delete(sessionId) {
    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async cleanup() {
    try {
      await this.init();
      const files = await fs.readdir(SESSIONS_DIR);
      const now = new Date();
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const filePath = path.join(SESSIONS_DIR, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const session = JSON.parse(content);
          if (now > new Date(session.expiresAt)) {
            await fs.unlink(filePath);
          }
        } catch {
          // If file is corrupted, delete it
          await fs.unlink(filePath).catch(() => undefined);
        }
      }
    } catch (error) {
      console.error('Failed cleanup of expired sessions:', error);
    }
  }
}
