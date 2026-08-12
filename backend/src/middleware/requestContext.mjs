import crypto from 'node:crypto';
import { logger, requestContext } from '../utils/logger.mjs';

/**
 * Middleware that initializes the request context with a unique ID and logs the request lifecycle.
 */
export function requestContextMiddleware(req, res, next) {
  // Extract or generate request ID
  let requestId = req.headers['x-request-id'];
  if (!requestId || typeof requestId !== 'string') {
    requestId = crypto.randomUUID();
  }

  // Set the requestId on the response headers so the client can trace it
  res.setHeader('x-request-id', requestId);

  // Store the request ID in AsyncLocalStorage
  requestContext.run({ requestId }, () => {
    const startTime = process.hrtime.bigint();
    
    // Do not log sensitive payloads (like code) in standard lifecycle logs
    const context = {
      method: req.method,
      path: req.path,
    };
    
    // Log request start for debug
    logger.debug('Request started', context);

    // Hook into response finish to log completion
    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;
      
      const finishContext = {
        ...context,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      };

      if (res.statusCode >= 500) {
        logger.error('Request completed with server error', null, finishContext);
      } else if (res.statusCode >= 400) {
        logger.warn('Request completed with client error', finishContext);
      } else {
        logger.info('Request completed', finishContext);
      }
    });

    next();
  });
}
