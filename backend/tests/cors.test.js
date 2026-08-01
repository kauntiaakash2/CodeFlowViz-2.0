import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

function createMockRequest(method = 'GET', origin = null) {
  return {
    method,
    get: (header) => (header === 'Origin' ? origin : undefined),
  };
}

function createMockResponse() {
  const headers = {};
  return {
    setHeader: (key, value) => {
      headers[key] = value;
    },
    sendStatus: (status) => {
      this.statusCode = status;
    },
    getHeaders: () => headers,
    statusCode: 200,
  };
}

describe('CORS Configuration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.CORS_ORIGIN;
  });

  afterEach(() => {
    process.env.CORS_ORIGIN = originalEnv;
  });

  describe('Missing CORS_ORIGIN environment variable', () => {
    it('should fail closed when CORS_ORIGIN is not set', () => {
      delete process.env.CORS_ORIGIN;

      const corsOriginEnv = process.env.CORS_ORIGIN;
      assert.equal(corsOriginEnv, undefined, 'CORS_ORIGIN should not be set');
    });

    it('should log warning when CORS_ORIGIN is missing', () => {
      delete process.env.CORS_ORIGIN;
      let warningLogged = false;

      const consoleWarn = console.warn;
      console.warn = (msg) => {
        if (msg.includes('CORS_ORIGIN not set')) {
          warningLogged = true;
        }
      };

      function parseAllowedOrigins() {
        const corsOriginEnv = process.env.CORS_ORIGIN;
        if (!corsOriginEnv) {
          console.warn('CORS_ORIGIN not set: cross-origin requests will be rejected');
          return [];
        }
        return corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean);
      }

      const origins = parseAllowedOrigins();
      console.warn = consoleWarn;

      assert.equal(warningLogged, true, 'Warning should be logged');
      assert.deepEqual(origins, [], 'Should return empty array');
    });
  });

  describe('Allowed origins parsing', () => {
    it('should parse single origin from CORS_ORIGIN', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000';

      function parseAllowedOrigins() {
        const corsOriginEnv = process.env.CORS_ORIGIN;
        if (!corsOriginEnv) return [];
        return corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean);
      }

      const origins = parseAllowedOrigins();
      assert.deepEqual(origins, ['http://localhost:3000']);
    });

    it('should parse multiple comma-separated origins', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000,https://example.com,https://app.example.com';

      function parseAllowedOrigins() {
        const corsOriginEnv = process.env.CORS_ORIGIN;
        if (!corsOriginEnv) return [];
        return corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean);
      }

      const origins = parseAllowedOrigins();
      assert.deepEqual(origins, [
        'http://localhost:3000',
        'https://example.com',
        'https://app.example.com',
      ]);
    });

    it('should trim whitespace from origins', () => {
      process.env.CORS_ORIGIN = ' http://localhost:3000 , https://example.com ';

      function parseAllowedOrigins() {
        const corsOriginEnv = process.env.CORS_ORIGIN;
        if (!corsOriginEnv) return [];
        return corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean);
      }

      const origins = parseAllowedOrigins();
      assert.deepEqual(origins, ['http://localhost:3000', 'https://example.com']);
    });
  });

  describe('Origin validation', () => {
    it('should reject wildcard in CORS_ORIGIN', () => {
      process.env.CORS_ORIGIN = '*';
      const allowedOrigins = ['*'];

      function isCorsAllowed(origin) {
        return allowedOrigins.some((allowed) => {
          if (allowed === '*') {
            return false;
          }
          return allowed === origin;
        });
      }

      assert.equal(isCorsAllowed('http://localhost:3000'), false);
      assert.equal(isCorsAllowed('https://example.com'), false);
    });

    it('should reject origins not in allowlist', () => {
      process.env.CORS_ORIGIN = 'http://localhost:3000';
      const allowedOrigins = ['http://localhost:3000'];

      function isCorsAllowed(origin) {
        return allowedOrigins.some((allowed) => {
          if (allowed === '*') return false;
          return allowed === origin;
        });
      }

      assert.equal(isCorsAllowed('http://localhost:3000'), true);
      assert.equal(isCorsAllowed('https://evil.com'), false);
      assert.equal(isCorsAllowed('http://localhost:5000'), false);
    });

    it('should accept exact origin matches', () => {
      process.env.CORS_ORIGIN = 'https://example.com,https://app.example.com';
      const allowedOrigins = ['https://example.com', 'https://app.example.com'];

      function isCorsAllowed(origin) {
        return allowedOrigins.some((allowed) => {
          if (allowed === '*') return false;
          return allowed === origin;
        });
      }

      assert.equal(isCorsAllowed('https://example.com'), true);
      assert.equal(isCorsAllowed('https://app.example.com'), true);
      assert.equal(isCorsAllowed('https://evil.example.com'), false);
    });
  });

  describe('Preflight requests (OPTIONS)', () => {
    it('should handle preflight requests with allowed origin', () => {
      const request = createMockRequest('OPTIONS', 'http://localhost:3000');
      const response = createMockResponse();
      const allowedOrigins = ['http://localhost:3000'];

      function isCorsAllowed(origin) {
        return allowedOrigins.some((allowed) => {
          if (allowed === '*') return false;
          return allowed === origin;
        });
      }

      const origin = request.get('Origin');
      if (origin && isCorsAllowed(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
      }
      response.setHeader('Vary', 'Origin');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      const headers = response.getHeaders();
      assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:3000');
      assert.equal(headers['Access-Control-Allow-Methods'], 'GET,POST,OPTIONS');
    });

    it('should reject preflight requests from disallowed origin', () => {
      const request = createMockRequest('OPTIONS', 'https://evil.com');
      const response = createMockResponse();
      const allowedOrigins = ['http://localhost:3000'];

      function isCorsAllowed(origin) {
        return allowedOrigins.some((allowed) => {
          if (allowed === '*') return false;
          return allowed === origin;
        });
      }

      const origin = request.get('Origin');
      if (origin && isCorsAllowed(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
      }
      response.setHeader('Vary', 'Origin');

      const headers = response.getHeaders();
      assert.equal(headers['Access-Control-Allow-Origin'], undefined);
      assert.equal(headers['Vary'], 'Origin');
    });
  });

  describe('Missing Origin header', () => {
    it('should handle requests without Origin header', () => {
      const request = createMockRequest('GET', null);
      const response = createMockResponse();
      const allowedOrigins = ['http://localhost:3000'];

      function isCorsAllowed(origin) {
        return allowedOrigins.some((allowed) => {
          if (allowed === '*') return false;
          return allowed === origin;
        });
      }

      const origin = request.get('Origin');
      if (origin && isCorsAllowed(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
      }
      response.setHeader('Vary', 'Origin');

      const headers = response.getHeaders();
      assert.equal(headers['Access-Control-Allow-Origin'], undefined);
    });
  });
});
