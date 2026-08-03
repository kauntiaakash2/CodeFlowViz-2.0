import { estimateComplexity } from './tracing/complexityAnalyzer.mjs';
import express from 'express';
import { runInSandbox } from './sandbox/runner.mjs';
import rateLimit from 'express-rate-limit';
import { SessionStore } from './services/sessionStore.js';
import { createRateLimiter } from './middleware/rateLimiter.js';

const DEFAULT_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 5_000;
const MIN_TIMEOUT_MS = 100;
const MAX_CODE_LENGTH = 20_000;
const MAX_OUTPUT_BYTES = 500_000; // 500 KB serialized output cap
const DEFAULT_PORT = 4000;

const app = express();
const port = Number.parseInt(process.env.PORT ?? `${DEFAULT_PORT}`, 10);
const allowedOrigin = process.env.CORS_ORIGIN ?? '*';

app.use((request, response, next) => {
  response.setHeader('Access-Control-Allow-Origin', allowedOrigin);
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

const sessionCreateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Too many sessions created from this IP. Please try again after a minute.',
});

const sessionGetLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'Too many requests. Please try again after a minute.',
});

app.post('/api/sessions', sessionCreateLimiter, async (request, response) => {
  const { code, output, selectedSnapshotIndex } = request.body ?? {};

  if (typeof code !== 'string') {
    response.status(400).json({ ok: false, error: '`code` must be a string.' });
    return;
  }

  // Bound output payload size before hitting the filesystem.
  if (output !== undefined && output !== null) {
    const serializedOutput = JSON.stringify(output);
    if (serializedOutput.length > MAX_OUTPUT_BYTES) {
      response.status(413).json({ ok: false, error: `Output payload exceeds the ${MAX_OUTPUT_BYTES} byte limit.` });
      return;
    }
  }

  // Ensure selectedSnapshotIndex is a safe finite integer or null.
  const safeIndex =
    typeof selectedSnapshotIndex === 'number' &&
    Number.isFinite(selectedSnapshotIndex) &&
    Number.isSafeInteger(selectedSnapshotIndex)
      ? selectedSnapshotIndex
      : null;

  try {
    const session = await SessionStore.save({ code, output, selectedSnapshotIndex: safeIndex });
    response.status(201).json({ ok: true, session });
  } catch (error) {
    response.status(500).json({ ok: false, error: 'Failed to save session.' });
  }
});

app.get('/api/sessions/:id', sessionGetLimiter, async (request, response) => {
  const sessionId = request.params.id;

  try {
    const session = await SessionStore.get(sessionId);
    if (!session) {
      response.status(404).json({ ok: false, error: 'Session not found or expired.' });
      return;
    }
    response.status(200).json({ ok: true, session });
  } catch (error) {
    response.status(500).json({ ok: false, error: 'Failed to retrieve session.' });
  }
});

// Initialize session store and periodic cleanup
SessionStore.init().catch(console.error);
setInterval(() => {
  SessionStore.cleanup().catch(console.error);
}, 60 * 60 * 1000);


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
