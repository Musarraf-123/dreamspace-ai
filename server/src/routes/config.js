import { Router } from 'express';

const router = Router();

router.get('/', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ googleClientId: process.env.GOOGLE_CLIENT_ID || '' });
});

export default router;
