import session from 'express-session';
import MongoStore from 'connect-mongo';
import { randomBytes } from 'node:crypto';

const week = 7 * 24 * 60 * 60 * 1000;

export function createSessionMiddleware() {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = (process.env.COOKIE_SAME_SITE || 'lax').toLowerCase();
  const secret = process.env.SESSION_SECRET;
  if (!['strict', 'lax', 'none'].includes(sameSite)) throw new Error('COOKIE_SAME_SITE must be Strict, Lax, or None.');
  if (sameSite === 'none' && !isProduction) throw new Error('SameSite=None requires production HTTPS.');
  if (isProduction && (!secret || secret.length < 32)) {
    throw new Error('SESSION_SECRET must be configured with at least 32 characters in production.');
  }
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be configured to use persistent sessions.');
  const store = MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions', ttl: week / 1000, autoRemove: 'native' });

  const middleware = session({
    name: 'dreamspace.sid',
    secret: secret || randomBytes(32).toString('hex'),
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite,
      maxAge: week,
      path: '/',
    },
  });
  middleware.sessionStore = store;
  return middleware;
}
