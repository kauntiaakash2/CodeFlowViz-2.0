import { AsyncLocalStorage } from 'node:async_hooks';

// Export the AsyncLocalStorage instance so the middleware can use it
export const requestContext = new AsyncLocalStorage();

/**
 * A simple structured JSON logger that automatically injects the current request ID.
 */
class Logger {
  #format(level, message, context = {}, error = null) {
    const store = requestContext.getStore();
    const requestId = store?.requestId || null;

    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      requestId,
      message,
    };

    if (Object.keys(context).length > 0) {
      logEntry.context = context;
    }

    if (error) {
      if (error instanceof Error) {
        logEntry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
        };
      } else {
        const message = typeof error === 'string' ? error : JSON.stringify(error) || String(error);
        logEntry.error = {
          name: 'UnknownError',
          message,
        };
      }
    }

    if (process.env.NODE_ENV === 'development') {
      // Pretty-print in development
      const idStr = requestId ? `[${requestId.split('-')[0]}] ` : '';
      let out = `${logEntry.timestamp} ${level.toUpperCase().padEnd(5)} ${idStr}${message}`;
      
      if (logEntry.context) {
        out += `\n  Context: ${JSON.stringify(logEntry.context)}`;
      }
      if (logEntry.error) {
        out += `\n  Error: ${logEntry.error.message}`;
        if (logEntry.error.stack) {
          out += `\n${logEntry.error.stack}`;
        }
      }
      return out;
    }

    // JSON in production
    return JSON.stringify(logEntry);
  }

  info(message, context = {}) {
    console.log(this.#format('info', message, context));
  }

  warn(message, context = {}, error = null) {
    console.warn(this.#format('warn', message, context, error));
  }

  error(message, error = null, context = {}) {
    console.error(this.#format('error', message, context, error));
  }

  debug(message, context = {}) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      console.log(this.#format('debug', message, context));
    }
  }
}

export const logger = new Logger();
