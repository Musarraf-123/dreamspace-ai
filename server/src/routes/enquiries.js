import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import Enquiry from '../models/Enquiry.js';
import Notification from '../models/Notification.js';
import Project from '../models/Project.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

const enquiryLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { error: 'You have sent several enquiries recently. Please try again later.' },
});

const enquirySchema = z.object({
  projectId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  name: z.string().trim().min(2, 'Enter your name.').max(80),
  phone: z.string().trim().min(7, 'Enter a phone number with at least 7 digits.').max(20).regex(/^[0-9+()\-\s]+$/, 'Use digits, spaces, +, - or brackets for the phone number.'),
  city: z.string().trim().min(2, 'Enter your city.').max(80),
  message: z.string().trim().min(5, 'Add a short description of the work.').max(1000),
}).strict();

router.post('/', enquiryLimit, async (req, res, next) => {
  const parsed = enquirySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the enquiry details and try again.' });
  try {
    if (parsed.data.projectId) {
      const project = await Project.exists({ _id: parsed.data.projectId, ownerId: req.user._id });
      if (!project) return res.status(404).json({ error: 'Project not found.' });
    }
    const enquiry = await Enquiry.create({ ...parsed.data, userId: req.user._id });
    await Notification.create({
      userId: req.user._id,
      type: 'enquiry',
      title: 'Contractor enquiry recorded',
      message: `We saved your enquiry for ${parsed.data.city}. Contractor matching is coming soon.`,
      link: parsed.data.projectId ? `/?project=${parsed.data.projectId}` : '/?page=My%20Projects',
    }).catch(() => {});
    return res.status(201).json({
      data: { id: String(enquiry._id), status: enquiry.status },
      message: 'Your contractor enquiry has been recorded. Live contractor matching is not enabled in this build.',
    });
  } catch (error) { return next(error); }
});

export default router;
