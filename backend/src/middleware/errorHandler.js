export class AppError extends Error {
  constructor(message, statusCode = 500, context = 'server', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.context = context;
    this.details = details;
  }
}

function isJsonSyntaxError(error) {
  return error instanceof SyntaxError && 'body' in error;
}

export function errorHandler(error, _request, response, _next) {
  const statusCode = isJsonSyntaxError(error)
    ? 400
    : error?.statusCode ?? error?.status ?? (error instanceof SyntaxError ? 422 : 500);

  const context = isJsonSyntaxError(error)
    ? 'request-body'
    : error?.context ?? (error instanceof SyntaxError ? 'user-code' : 'server');

  const message = isJsonSyntaxError(error)
    ? 'Request body must be valid JSON.'
    : typeof error?.message === 'string' && error.message.trim().length > 0
      ? error.message
      : 'Unexpected backend error.';

  response.status(statusCode).json({
    error: true,
    message,
    context,
  });
}