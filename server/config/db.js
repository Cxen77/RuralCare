const mongoose = require('mongoose');
const env = require('./env');

const STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

async function connectDb() {
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 3500 });
    return mongoose.connection;
  } catch (atlasErr) {
    console.warn(`[db] Atlas connection failed (${atlasErr.message}). Attempting local MongoDB at 127.0.0.1:27017...`);
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/ruralcare-db', { serverSelectionTimeoutMS: 3000 });
      console.log('[db] Connected to local MongoDB instance.');
      return mongoose.connection;
    } catch {
      throw atlasErr;
    }
  }
}

function dbState() {
  return STATES[mongoose.connection.readyState] || 'unknown';
}

async function disconnectDb() {
  await mongoose.connection.close();
}

module.exports = { connectDb, dbState, disconnectDb };
