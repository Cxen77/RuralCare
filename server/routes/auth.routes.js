const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const env = require('../config/env');
const { ok } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      patientId: user.patientId,
      doctorId: user.doctorId,
      pharmacyId: user.pharmacyId,
      hospitalId: user.hospitalId,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    patientId: user.patientId,
    doctorId: user.doctorId,
    pharmacyId: user.pharmacyId,
    hospitalId: user.hospitalId,
  };
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new ApiError(400, 'MISSING_CREDENTIALS', 'email and password are required.');
    }
    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user || !user.isActive) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    return ok(res, { token: signToken(user), user: publicUser(user) });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findOne({ id: req.user.sub });
    if (!user) throw new ApiError(404, 'NOT_FOUND', 'User not found.');
    return ok(res, publicUser(user));
  })
);

module.exports = router;
