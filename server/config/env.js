const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value || !String(value).trim()) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        'Copy server/.env.example to server/.env and fill it in.'
    );
  }
  return value;
}

const NODE_ENV = process.env.NODE_ENV || 'development';

const env = {
  NODE_ENV,
  isProd: NODE_ENV === 'production',
  PORT: parseInt(process.env.PORT, 10) || 4000,
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '12h',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  SEED_ALLOW_PROD: process.env.SEED_ALLOW_PROD === 'true',
};

module.exports = env;
