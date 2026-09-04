const ApiError = require('../utils/ApiError');

// Gate a route to one or more roles. Assumes requireAuth ran first.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'UNAUTHENTICATED', 'Authentication required.'));
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return next(new ApiError(403, 'FORBIDDEN', `Requires role: ${roles.join(' or ')}.`));
    }
    return next();
  };
}

module.exports = { requireRole };
