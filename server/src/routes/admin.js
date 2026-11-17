import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import User from '../models/User.js';
import Project from '../models/Project.js';
import DesignAsset from '../models/DesignAsset.js';
import Enquiry from '../models/Enquiry.js';
import Feedback from '../models/Feedback.js';
import requireAuth from '../middleware/requireAuth.js';
import requireAdmin, { isAdminEmail } from '../middleware/requireAdmin.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

router.get('/stats', async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [users, newUsers, projects, designs, enquiries, openEnquiries, feedback, newFeedback] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ createdAt: { $gte: since } }),
      Project.countDocuments({ saved: true }),
      DesignAsset.countDocuments({ kind: 'generated' }),
      Enquiry.countDocuments({}),
      Enquiry.countDocuments({ status: 'new' }),
      Feedback.countDocuments({}),
      Feedback.countDocuments({ status: 'new' }),
    ]);
    return res.json({ data: { users, newUsers, projects, designs, enquiries, openEnquiries, feedback, newFeedback } });
  } catch (error) { return next(error); }
});

router.get('/users', async (req, res, next) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid pagination values.' });
  const { page, limit } = parsed.data;
  const query = String(req.query.q || '').trim().slice(0, 80);
  const filter = query ? { $or: [{ name: { $regex: query, $options: 'i' } }, { email: { $regex: query, $options: 'i' } }] } : {};
  try {
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    return res.json({
      data: users.map((user) => ({
        id: String(user._id),
        name: user.name,
        email: user.email,
        city: user.city,
        role: user.role === 'admin' || isAdminEmail(user.email) ? 'admin' : 'user',
        authProvider: user.authProvider,
        createdAt: user.createdAt,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) { return next(error); }
});

router.patch('/users/:id/role', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'User not found.' });
  const parsed = z.object({ role: z.enum(['user', 'admin']) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid role.' });
  if (String(req.params.id) === String(req.user._id)) return res.status(400).json({ error: 'You cannot change your own role.' });
  try {
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (parsed.data.role === 'user' && isAdminEmail(target.email)) {
      return res.status(400).json({ error: 'This account is configured as an administrator through ADMIN_EMAILS. Remove it there to change the role.' });
    }
    target.role = parsed.data.role;
    await target.save();
    return res.json({ data: { id: String(target._id), role: target.role } });
  } catch (error) { return next(error); }
});

router.get('/enquiries', async (req, res, next) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid pagination values.' });
  try {
    const filter = {};
    if (['new', 'contacted', 'closed'].includes(req.query.status)) filter.status = req.query.status;
    const { page, limit } = parsed.data;
    const [enquiries, total] = await Promise.all([
      Enquiry.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('userId', 'name email').populate('projectId', 'title').lean(),
      Enquiry.countDocuments(filter),
    ]);
    return res.json({
      data: enquiries.map((enquiry) => ({
        id: String(enquiry._id),
        name: enquiry.name,
        phone: enquiry.phone,
        city: enquiry.city,
        message: enquiry.message,
        status: enquiry.status,
        createdAt: enquiry.createdAt,
        user: enquiry.userId ? { name: enquiry.userId.name, email: enquiry.userId.email } : null,
        project: enquiry.projectId ? { id: String(enquiry.projectId._id), title: enquiry.projectId.title } : null,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) { return next(error); }
});

router.patch('/enquiries/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Enquiry not found.' });
  const parsed = z.object({ status: z.enum(['new', 'contacted', 'closed']) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid enquiry status.' });
  try {
    const enquiry = await Enquiry.findByIdAndUpdate(req.params.id, { $set: { status: parsed.data.status } }, { new: true });
    if (!enquiry) return res.status(404).json({ error: 'Enquiry not found.' });
    return res.json({ data: { id: String(enquiry._id), status: enquiry.status } });
  } catch (error) { return next(error); }
});

router.get('/feedback', async (req, res, next) => {
  const parsed = pageSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid pagination values.' });
  try {
    const filter = {};
    if (['new', 'reviewed', 'closed'].includes(req.query.status)) filter.status = req.query.status;
    const { page, limit } = parsed.data;
    const [feedback, total] = await Promise.all([
      Feedback.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('userId', 'name email').lean(),
      Feedback.countDocuments(filter),
    ]);
    return res.json({
      data: feedback.map((entry) => ({
        id: String(entry._id),
        rating: entry.rating,
        category: entry.category,
        message: entry.message,
        status: entry.status,
        createdAt: entry.createdAt,
        user: entry.userId ? { name: entry.userId.name, email: entry.userId.email } : null,
      })),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / parsed.data.limit)),
    });
  } catch (error) { return next(error); }
});

router.patch('/feedback/:id', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Feedback not found.' });
  const parsed = z.object({ status: z.enum(['new', 'reviewed', 'closed']) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose a valid feedback status.' });
  try {
    const feedback = await Feedback.findByIdAndUpdate(req.params.id, { $set: { status: parsed.data.status } }, { new: true });
    if (!feedback) return res.status(404).json({ error: 'Feedback not found.' });
    return res.json({ data: { id: String(feedback._id), status: feedback.status } });
  } catch (error) { return next(error); }
});

export default router;
