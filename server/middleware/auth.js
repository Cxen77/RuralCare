const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return next(new ApiError(401, 'UNAUTHENTICATED', 'Missing or malformed Authorization header.'));
  }
  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    return next();
  } catch (e) {
    return next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token.'));
  }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      req.user = jwt.verify(token, env.JWT_SECRET);
    } catch (e) {
      // Ignore token verification errors for optional authentication
    }
  }
  return next();
}

module.exports = { requireAuth, optionalAuth };
