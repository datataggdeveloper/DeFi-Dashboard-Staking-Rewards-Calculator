/**
 * Error raised when caller-supplied input is invalid or out of range.
 * Deliberately free of any HTTP/Express concepts so the calculation engine
 * can be reused anywhere; the HTTP layer maps it to a 400 response.
 */
class InputValidationError extends Error {
  /**
   * @param {string} message  Human readable summary.
   * @param {{field: string, message: string}[]} [details]  Per-field problems.
   */
  constructor(message, details = []) {
    super(message);
    this.name = 'InputValidationError';
    this.details = details;
  }
}

module.exports = { InputValidationError };
