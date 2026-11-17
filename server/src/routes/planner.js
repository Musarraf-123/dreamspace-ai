import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import PlanTask from '../models/PlanTask.js';
import Project from '../models/Project.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

const taskLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 80,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { error: 'You are changing your renovation plan too quickly. Please try again later.' },
});
const taskSchema = z.object({
  title: z.string().trim().min(2, 'Enter a task name.').max(120),
  phase: z.enum(['planning', 'design', 'procurement', 'execution', 'handover']).optional().default('planning'),
  projectId: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  order: z.number().int().min(0).max(1000).optional(),
}).strict();
const patchSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  phase: z.enum(['planning', 'design', 'procurement', 'execution', 'handover']).optional(),
  done: z.boolean().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  order: z.number().int().min(0).max(1000).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide a task field to update.');

const TEMPLATE = [
  ['Confirm scope and budget', 'planning'],
  ['Measure rooms and openings', 'planning'],
  ['Finalise layout and materials', 'design'],
  ['Get three contractor quotes', 'procurement'],
  ['Order tiles, fittings and paint', 'procurement'],
  ['Schedule demolition and site prep', 'execution'],
  ['Supervise electrical and plumbing work', 'execution'],
  ['Snag list and final handover', 'handover'],
];

async function assertProjectOwned(userId, projectId) {
  if (!projectId) return true;
  return Project.exists({ _id: projectId, ownerId: userId });
}

router.get('/', async (req, res, next) => {
  try {
    const filter = { userId: req.user._id };
    if (req.query.projectId) {
      if (!mongoose.isValidObjectId(req.query.projectId)) return res.status(400).json({ error: 'Invalid project ID.' });
      filter.projectId = req.query.projectId;
    }
    const tasks = await PlanTask.find(filter).sort({ phase: 1, order: 1, createdAt: 1 }).limit(200).lean();
    return res.json({ data: tasks });
  } catch (error) { return next(error); }
});

router.post('/', taskLimit, async (req, res, next) => {
  const parsed = taskSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the task details.' });
  try {
    if (!await assertProjectOwned(req.user._id, parsed.data.projectId)) return res.status(404).json({ error: 'Project not found.' });
    const task = await PlanTask.create({ ...parsed.data, userId: req.user._id });
    return res.status(201).json({ data: task });
  } catch (error) { return next(error); }
});

router.post('/template', taskLimit, async (req, res, next) => {
  const parsed = z.object({ projectId: z.string().regex(/^[a-f\d]{24}$/i).optional() }).strict().safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'Invalid project ID.' });
  try {
    if (!await assertProjectOwned(req.user._id, parsed.data.projectId)) return res.status(404).json({ error: 'Project not found.' });
    const filter = { userId: req.user._id };
    if (parsed.data.projectId) filter.projectId = parsed.data.projectId;
    const existing = await PlanTask.find(filter).select('title phase').lean();
    const existingKeys = new Set(existing.map((task) => `${task.phase}:${task.title.toLowerCase()}`));
    const missing = TEMPLATE.filter(([title, phase]) => !existingKeys.has(`${phase}:${title.toLowerCase()}`));
    if (missing.length) {
      await PlanTask.insertMany(missing.map(([title, phase], index) => ({ userId: req.user._id, projectId: parsed.data.projectId, title, phase, order: index })));
    }
    const tasks = await PlanTask.find(filter).sort({ phase: 1, order: 1, createdAt: 1 }).lean();
    return res.json({ data: tasks, added: missing.length });
  } catch (error) { return next(error); }
});

router.patch('/:id', taskLimit, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Task not found.' });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check the task details.' });
  try {
    const task = await PlanTask.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: parsed.data },
      { new: true, runValidators: true },
    );
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    return res.json({ data: task });
  } catch (error) { return next(error); }
});

router.delete('/:id', taskLimit, async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Task not found.' });
  try {
    const task = await PlanTask.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!task) return res.status(404).json({ error: 'Task not found.' });
    return res.json({ message: 'Task removed.' });
  } catch (error) { return next(error); }
});

export default router;
