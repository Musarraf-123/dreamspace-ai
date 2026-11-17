import mongoose from 'mongoose';

let listenersRegistered = false;

function logConnectionEvent(level, message, error) {
  const event = { level, message };
  if (error) {
    event.name = error.name;
    event.code = error.code;
  }
  console[level === 'error' ? 'error' : 'info'](JSON.stringify(event));
}

function registerConnectionListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;
  mongoose.connection.on('disconnected', () => logConnectionEvent('warn', 'MongoDB connection disconnected'));
  mongoose.connection.on('reconnected', () => logConnectionEvent('info', 'MongoDB connection restored'));
  mongoose.connection.on('error', (error) => logConnectionEvent('error', 'MongoDB connection error', error));
}

export async function connectDatabase(uri, { serverSelectionTimeoutMS = 10_000 } = {}) {
  if (!uri) {
    throw new Error('MONGODB_URI must be configured before the API can start.');
  }

  registerConnectionListeners();
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS });
    await mongoose.connection.db.admin().command({ ping: 1 });
    logConnectionEvent('info', 'MongoDB connection ready');
    return mongoose.connection;
  } catch (error) {
    logConnectionEvent('error', 'MongoDB connection failed', error);
    await mongoose.disconnect().catch(() => {});
    throw new Error('MongoDB could not be reached. Check the server-side MONGODB_URI and Atlas network access.', { cause: error });
  }
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
}

export function databaseConnectionStatus() {
  return ({ 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' })[mongoose.connection.readyState] || 'unknown';
}
