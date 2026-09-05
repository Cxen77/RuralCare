const env = require('../config/env');
const { fail } = require('../utils/response');
const ApiError = require('../utils/ApiError');

function notFound(req, res) {
  return fail(res, 404, 'NOT_FOUND', `Route not found: ${req.method} ${req.originalUrl}`);
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return fail(res, err.status, err.code, err.message);
  }
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
    return fail(res, 400, 'VALIDATION_ERROR', message);
  }
  if (err.name === 'CastError') {
    return fail(res, 400, 'INVALID_ID', `Invalid ${err.path}: ${err.value}`);
  }
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).join(', ');
    return fail(res, 409, 'DUPLICATE_KEY', `Duplicate value for: ${field}`);
  }
  if (
    err.name === 'MongooseError' ||
    err.name === 'MongooseServerSelectionError' ||
    (err.message && err.message.includes('buffering timed out'))
  ) {
    console.error('[DATABASE ERROR]', err.message);
    return fail(res, 503, 'DATABASE_UNAVAILABLE', 'Database is currently connecting or unavailable. Please check MongoDB Atlas connection and IP access.');
  }
  console.error('[UNHANDLED ERROR]', err);
  const message = env.isProd ? 'Internal server error' : err.message;
  return fail(res, 500, 'INTERNAL_ERROR', message);
}

module.exports = { notFound, errorHandler };
