import './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { seedCatalog } from './services/catalogSeed.js';
import User from './models/User.js';

const port = Number(process.env.PORT) || 5000;
await connectDatabase(process.env.MONGODB_URI);
try {
  const emails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length) {
    const result = await User.updateMany({ email: { $in: emails } }, { $set: { role: 'admin' } });
    console.info(JSON.stringify({ level: 'info', message: 'Admin accounts synced', configured: emails.length, updated: result.modifiedCount }));
  }
  const seeded = await seedCatalog();
  console.info(JSON.stringify({ level: 'info', message: 'Rate card and material catalogue ready', ...seeded }));
} catch (error) {
  console.warn(JSON.stringify({ level: 'warn', message: 'Startup seed skipped', name: error.name }));
}
const { default: app } = await import('./app.js');
const server = app.listen(port, '0.0.0.0', () => console.info(JSON.stringify({ level: 'info', message: 'DreamSpace API listening', port, host: '0.0.0.0', environment: process.env.NODE_ENV || 'development' })));

let shutdownStarted = false;
async function shutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;
  console.info(JSON.stringify({ level: 'info', message: 'API shutdown started', signal }));
  const forceExit = setTimeout(() => {
    console.error(JSON.stringify({ level: 'error', message: 'API shutdown timed out' }));
    process.exit(1);
  }, 15_000);
  forceExit.unref();

  try {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await app.locals.sessionStore.close();
    await disconnectDatabase();
    clearTimeout(forceExit);
    console.info(JSON.stringify({ level: 'info', message: 'API shutdown complete' }));
    process.exitCode = 0;
  } catch (error) {
    console.error(JSON.stringify({ level: 'error', message: 'API shutdown failed', name: error.name, code: error.code }));
    process.exitCode = 1;
  }
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
