import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSIONS_DIR = path.join(__dirname, '../../data/sessions');
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours TTL

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
    // 8-character hex string
    const sessionId = crypto.randomBytes(4).toString('hex');

    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + SESSION_TTL_MS);

    const payload = {
      id: sessionId,
      ...sessionData,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    const filePath = path.join(SESSIONS_DIR, `${sessionId}.json`);
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    return payload;
  }

  static async get(sessionId) {
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
      return null;
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
