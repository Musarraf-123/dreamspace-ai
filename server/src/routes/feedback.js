import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Feedback from '../models/Feedback.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

const feedbackLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { error: 'You have shared feedback recently. Please try again tomorrow.' },
});
const feedbackSchema = z.object({
  rating: z.number().int().min(1, 'Choose a rating.').max(5),
  category: z.enum(['general', 'design', 'estimate', 'bug', 'idea']).optional().default('general'),
  message: z.string().trim().min(5, 'Add a little more detail.').max(1000, 'Keep feedback under 1000 characters.'),
}).strict();

router.post('/', feedbackLimit, async (req, res, next) => {
  const parsed = feedbackSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your feedback and try again.' });
  try {
    const feedback = await Feedback.create({ ...parsed.data, userId: req.user._id });
    return res.status(201).json({ data: { id: String(feedback._id) }, message: 'Thank you. Your feedback helps us improve DreamSpace.' });
  } catch (error) { return next(error); }
});

export default router;
