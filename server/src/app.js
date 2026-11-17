import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import healthRouter from './routes/health.js';
import projectsRouter from './routes/projects.js';
import authRouter from './routes/auth.js';
import designsRouter from './routes/designs.js';
import designAssetsRouter from './routes/designAssets.js';
import catalogRouter from './routes/catalog.js';
import enquiriesRouter from './routes/enquiries.js';
import notificationsRouter from './routes/notifications.js';
import plannerRouter from './routes/planner.js';
import feedbackRouter from './routes/feedback.js';
import adminRouter from './routes/admin.js';
import publicProjectsRouter from './routes/publicProjects.js';
import configRouter from './routes/config.js';
import { generateRedesign } from './services/openaiImageEdit.js';
import { createSessionMiddleware } from './middleware/session.js';
import { resolveAllowedOrigins } from './config/origins.js';
import { databaseConnectionStatus } from './config/database.js';

const app = express();
app.locals.imageGenerator = generateRedesign;
const allowedOrigins = resolveAllowedOrigins({
  nodeEnv: process.env.NODE_ENV,
  clientOrigin: process.env.CLIENT_ORIGIN,
  devClientOrigin: process.env.DEV_CLIENT_ORIGIN,
});

app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(helmet({
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  contentSecurityPolicy: {
    directives: {
      'script-src': ["'self'", 'https://accounts.google.com'],
      'connect-src': ["'self'", 'https://accounts.google.com'],
      'frame-src': ['https://accounts.google.com'],
    },
  },
}));
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(null, false);
}, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }));
app.use((req, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    console.info(JSON.stringify({ level: 'info', requestId: req.requestId, method: req.method, path: req.path, status: res.statusCode, durationMs: Math.round(durationMs * 10) / 10 }));
  });
  next();
});
// CORS controls browser access; this origin check also prevents cross-site state changes
// from forms and requests that do not require a CORS preflight.
app.use((req, res, next) => {
  const origin = req.get('origin');
  if (origin && !allowedOrigins.includes(origin)) return res.status(403).json({ error: 'This request origin is not allowed.' });
  if (req.path.startsWith('/api/design-assets/') && !origin && req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ error: 'Cross-site access to private project images is not allowed.' });
  }
  return next();
});
app.use(express.json({ limit: '1mb' }));
const sessionMiddleware = createSessionMiddleware();
app.use(sessionMiddleware);
app.locals.sessionStore = sessionMiddleware.sessionStore;

const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), '../../client/dist');
const serveClient = (process.env.NODE_ENV === 'production' || process.env.SERVE_CLIENT === 'true') && existsSync(clientDist);

app.get('/', (_req, res, next) => {
  if (serveClient) return next();
  return res.json({ service: 'DreamSpace AI API', docs: '/api/health' });
});
app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/designs', designsRouter);
app.use('/api/design-assets', designAssetsRouter);
app.use('/api/catalog', catalogRouter);
app.use('/api/enquiries', enquiriesRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/planner', plannerRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/admin', adminRouter);
app.use('/api/public', publicProjectsRouter);
app.use('/api/config', configRouter);

if (serveClient) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    return res.sendFile(resolve(clientDist, 'index.html'));
  });
}
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));
app.use((error, req, res, _next) => {
  if (error.status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.requestId, name: error.name, code: error.code, message: error.publicMessage || 'Unhandled server error' }));
  if (res.headersSent) return;
  if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Choose an image smaller than 8 MB.' });
  if (error.code === 'LIMIT_UNEXPECTED_FILE' || error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_FIELD_COUNT' || error.code === 'LIMIT_PART_COUNT' || error.code === 'LIMIT_FIELD_VALUE') return res.status(400).json({ error: 'The upload contains an unsupported or oversized field.' });
  const databaseUnavailable = databaseConnectionStatus() !== 'connected'
    || ['MongooseServerSelectionError', 'MongoServerSelectionError', 'MongoNetworkError', 'MongoNotConnectedError'].includes(error.name)
    || /buffering timed out/i.test(error.message || '');
  if (databaseUnavailable) return res.status(503).json({ error: 'Account storage is temporarily unavailable. Please try again shortly.' });
  const publicMessage = error.publicMessage || (error.status && error.status < 500 ? error.message : error.status === 503 ? 'This service is temporarily unavailable. Please try again shortly.' : 'Something went wrong. Please try again.');
  return res.status(error.status ?? 500).json({ error: publicMessage });
});

export default app;
