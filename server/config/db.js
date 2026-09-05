const mongoose = require('mongoose');
const env = require('./env');

let lastDbError = null;

async function connectDb() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    lastDbError = null;
    return mongoose.connection;
  } catch (atlasErr) {
    lastDbError = atlasErr.message;
    console.warn(`[db] Primary connection failed (${atlasErr.message}). Attempting local fallback...`);
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/ruralcare-db', { serverSelectionTimeoutMS: 2000 });
      console.log('[db] Connected to local MongoDB instance.');
      lastDbError = null;
      return mongoose.connection;
    } catch (localErr) {
      lastDbError = atlasErr.message;
      throw atlasErr;
    }
  }
}

function dbState() {
  return STATES[mongoose.connection.readyState] || 'unknown';
}

function getDbError() {
  return lastDbError;
}

async function disconnectDb() {
  await mongoose.connection.close();
}

module.exports = { connectDb, dbState, getDbError, disconnectDb };
