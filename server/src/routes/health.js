import { Router } from 'express';
import { databaseConnectionStatus } from '../config/database.js';

const router = Router();
router.get('/', (_req, res) => {
  const database = databaseConnectionStatus();
  const connected = database === 'connected';
  return res.status(connected ? 200 : 503).json({
  status: connected ? 'ok' : 'unavailable',
  service: 'dreamspace-api',
  timestamp: new Date().toISOString(),
  database,
  });
});
export default router;
