'use strict';

/**
 * Global error handler middleware.
 * Provides consistent error response format without leaking stack traces in production.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * Maps known error types to HTTP status codes.
 * @param {Error} err
 * @returns {number}
 */
function getStatusCode(err) {
  if (err.status || err.statusCode) return err.status || err.statusCode;
  if (err.name === 'ValidationError') return 400;
  if (err.message?.includes('not found')) return 404;
  if (err.message?.includes('Rate limit')) return 429;
  if (err.message?.includes('Gemini')) return 503;
  if (err.message?.includes('API key')) return 503;
  return 500;
}

/**
 * Express 404 handler (no route matched).
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} does not exist`,
  });
}

/**
 * Global error handler.
 * Must have 4 arguments for Express to treat it as error handler.
 */
function errorHandler(err, req, res, _next) {
  const status = getStatusCode(err);

  // Always log errors server-side
  console.error(`[ERROR] ${req.method} ${req.path} → ${status}: ${err.message}`);
  if (err.stack) console.error(err.stack);
  if (err.cause) console.error('Error Cause:', err.cause);

  res.status(status).json({
    error: getErrorTitle(status),
    message: IS_PROD && status === 500
      ? 'An internal server error occurred. Please try again.'
      : err.message,
    ...(IS_PROD ? {} : { stack: err.stack }),
  });
}

function getErrorTitle(status) {
  const TITLES = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    429: 'Too Many Requests',
    503: 'Service Unavailable',
    500: 'Internal Server Error',
  };
  return TITLES[status] || 'Error';
}

module.exports = { errorHandler, notFoundHandler };
