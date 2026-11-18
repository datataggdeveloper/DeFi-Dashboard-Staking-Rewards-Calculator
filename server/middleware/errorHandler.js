const { InputValidationError } = require('../utils/errors');

/**
 * Centralized error handler (must be registered after all routes).
 * - InputValidationError and malformed JSON bodies -> 400 with a clear message
 * - anything else -> 500 with a generic message (details are only logged)
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof InputValidationError) {
    return res.status(400).json({
      error: { message: err.message, details: err.details }
    });
  }

  // body-parser (express.json) reports malformed JSON with a 400-class status.
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { message: 'Request body contains invalid JSON.', details: [] }
    });
  }
  if (err && err.type === 'entity.too.large') {
    return res.status(413).json({
      error: { message: 'Request body is too large.', details: [] }
    });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: { message: 'Internal Server Error', details: [] }
  });
};

module.exports = errorHandler;
