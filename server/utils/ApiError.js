// Typed error carrying an HTTP status + stable machine code for the response envelope.
class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

module.exports = ApiError;
