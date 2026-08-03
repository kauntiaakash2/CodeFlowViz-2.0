import { estimateComplexity } from './tracing/complexityAnalyzer.mjs';
import express from 'express';
import { runInSandbox } from './sandbox/runner.mjs';
import rateLimit from 'express-rate-limit';

const DEFAULT_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 100;
const MAX_CODE_LENGTH = 20_000;
const DEFAULT_PORT = 4000;

const app = express();
const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);

function parseAllowedOrigins() {
  const corsOriginEnv = process.env.CORS_ORIGIN;

  if (!corsOriginEnv) {
    console.warn('CORS_ORIGIN not set: cross-origin requests will be rejected. For local development, set CORS_ORIGIN=http://localhost:3000');
    return [];
  }

  return corsOriginEnv.split(',').map((origin) => origin.trim()).filter(Boolean);
}

const allowedOrigins = parseAllowedOrigins();

function isCorsAllowed(origin) {
  return allowedOrigins.some((allowed) => {
    if (allowed === '*') {
      console.error('Security: CORS_ORIGIN contains wildcard "*" which is not allowed in this configuration');
      return false;
    }
    return allowed === origin;
  });
}

app.use((request, response, next) => {
  const origin = request.get('Origin');

  if (origin && isCorsAllowed(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  }

  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }

  next();
});

app.use(express.json({ limit: '64kb' }));

const executeLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests. Please slow down.' },
});

function normalizeTimeout(timeoutMs) {
  if (typeof timeoutMs !== 'number' || Number.isNaN(timeoutMs)) return DEFAULT_TIMEOUT_MS;
  return Math.min(MAX_TIMEOUT_MS, Math.max(MIN_TIMEOUT_MS, Math.trunc(timeoutMs)));
}

function healthResponse(_request, response) {
  response.status(200).json({
    status: 'ok',
    service: 'codeflowviz-backend',
    timestamp: new Date().toISOString(),
  });
}

app.get('/health', healthResponse);
app.get('/api/health', healthResponse);

app.post('/api/execute', executeLimiter, async (request, response) => {
  const { code, timeoutMs, language = 'javascript' } = request.body ?? {};

  if (typeof code !== 'string') {
    response.status(400).json({ ok: false, error: '`code` must be a string.' });
    return;
  }

  if (code.length > MAX_CODE_LENGTH) {
    response.status(413).json({ ok: false, error: `Code exceeds the ${MAX_CODE_LENGTH} character limit.` });
    return;
  }

  // 1. Generate the Big-O Estimate from the AST (skip for non-JavaScript languages)
  const isJavaScript = language === 'javascript' || language === 'js';
  const complexityEstimate = isJavaScript ? estimateComplexity(code) : { bigO: 'Unknown', explanation: 'Complexity analysis only available for JavaScript' };
  const normalizedTimeoutMs = normalizeTimeout(timeoutMs);

  let result;
  try {
    result = await runInSandbox(code, normalizedTimeoutMs, language);
  } catch (err) {
    response.status(503).json({ ok: false, error: err.message, logs: [], timeline: [], durationMs: 0, timedOut: false });
    return;
  }

  if (result.ok) {
    result.complexity = complexityEstimate;
  }

  response.status(result.ok ? 200 : 422).json(result);
});

app.use((error, _request, response, _next) => {
  if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ ok: false, error: 'Request body must be valid JSON.' });
    return;
  }

  response.status(500).json({ ok: false, error: 'Unexpected backend error.' });
});

app.listen(port, () => {
  console.log(`CodeFlowViz backend listening on http://localhost:${port}`);
});
