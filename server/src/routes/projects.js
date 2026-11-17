import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import { z } from 'zod';
import Project from '../models/Project.js';
import DesignAsset from '../models/DesignAsset.js';
import PlanTask from '../models/PlanTask.js';
import requireAuth from '../middleware/requireAuth.js';
import { normalizeImage } from '../services/imageProcessing.js';

const router = Router();
const referenceUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 2, parts: 3 }, fileFilter: (_req, file, callback) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(null, true);
  const error = new Error('Upload a JPG, PNG or WebP image.'); error.status = 400; return callback(error);
} });
const projectSchema = z.object({
  title: z.string().trim().min(1, 'Project title is required.').max(100),
  type: z.enum(['interior', 'exterior', '3d', 'renovation']),
  room: z.string().trim().max(60).optional(),
  style: z.string().trim().max(60).optional(),
  prompt: z.string().trim().max(2000).optional(),
  imageKey: z.string().regex(/^photo-[a-zA-Z0-9-]{4,80}$/).optional(),
  estimate: z.number().min(0).max(100000000).optional(),
  rooms: z.array(z.object({
    name: z.string().trim().min(1, 'Give each room a name.').max(60),
    length: z.number().min(0).max(60).optional(),
    width: z.number().min(0).max(60).optional(),
    height: z.number().min(0).max(20).optional(),
    openingsArea: z.number().min(0).max(500).optional(),
    notes: z.string().trim().max(200).optional(),
  }).strict()).max(12, 'Add up to 12 rooms per project.').optional(),
  measurements: z.object({
    length: z.number().min(3).max(60), width: z.number().min(3).max(60), height: z.number().min(7).max(20),
    openingsArea: z.number().min(0).max(500).optional(),
    unit: z.literal('ft').default('ft'), city: z.string().trim().min(2).max(60),
  }).strict().optional(),
  estimateReport: z.object({
    renovationType: z.string().trim().min(2).max(80), quality: z.string().trim().min(2).max(30),
    low: z.number().min(0).max(100000000), expected: z.number().min(0).max(100000000), high: z.number().min(0).max(100000000),
    currency: z.literal('INR').default('INR'),
    items: z.array(z.object({ key: z.string().max(40).optional(), name: z.string().trim().min(1).max(100), quantity: z.number().min(0).max(1000000), unit: z.string().max(40), unitRate: z.number().min(0).max(1000000), low: z.number().min(0).max(100000000), expected: z.number().min(0).max(100000000), high: z.number().min(0).max(100000000) }).strict()).max(20),
    shoppingList: z.array(z.object({ name: z.string().trim().min(1).max(100), quantity: z.number().min(0).max(1000000), unit: z.string().max(40) }).strict()).max(30),
    assumptions: z.array(z.string().trim().min(1).max(240)).max(10).optional(),
  }).strict().refine((report) => report.low <= report.expected && report.expected <= report.high, 'Cost range must be ordered low, expected, then high.').optional(),
}).strict();
const patchSchema = z.object({
  title: z.string().trim().min(1, 'Project name cannot be empty.').max(100).optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
  estimate: z.number().min(0).max(100000000).optional(),
  rooms: projectSchema.shape.rooms,
  measurements: projectSchema.shape.measurements,
  estimateReport: projectSchema.shape.estimateReport,
}).strict().refine((value) => Object.keys(value).length > 0, 'Provide a project field to update.');

router.use(requireAuth);
const projectWriteLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user._id),
  message: { error: 'You are making project changes too quickly. Please try again later.' },
});

router.get('/', async (req, res, next) => {
  try {
    const filter = { ownerId: req.user._id, saved: true };
    if (req.query.archived === '1' || req.query.archived === 'true') filter.archived = true;
    else if (req.query.includeArchived !== '1' && req.query.includeArchived !== 'true') filter.archived = { $ne: true };
    const projects = await Project.find(filter).sort({ updatedAt: -1 }).limit(100).lean();
    return res.json({ data: projects });
  } catch (error) { return next(error); }
});

router.get('/:id', async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Project not found.' });
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user._id, saved: true }).lean();
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    return res.json({ data: project });
  } catch (error) { return next(error); }
});

router.post('/', projectWriteLimit, async (req, res, next) => {
  const parsed = projectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please check your project details.' });
  try {
    const project = await Project.create({ ...parsed.data, ownerId: req.user._id });
    return res.status(201).json({ data: project });
  } catch (error) { return next(error); }
});

router.post('/:id/save', projectWriteLimit, async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid project ID.' });
  try {
    const project = await Project.findOneAndUpdate({ _id: req.params.id, ownerId: req.user._id }, { $set: { saved: true } }, { new: true });
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    return res.json({ data: project });
  } catch (error) { return next(error); }
});

router.post('/:id/duplicate', projectWriteLimit, async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Project not found.' });
  try {
    const source = await Project.findOne({ _id: req.params.id, ownerId: req.user._id, saved: true }).lean();
    if (!source) return res.status(404).json({ error: 'Project not found.' });
    const { _id, __v, createdAt, updatedAt, generations, generatedImages, sourceAssetId, referenceAssetId, shareToken, sharedAt, ownerId, ...rest } = source;
    const project = await Project.create({
      ...rest,
      ownerId: req.user._id,
      title: `${source.title} — copy`.slice(0, 100),
      favorite: false,
      archived: false,
      saved: true,
      status: 'draft',
      rooms: (source.rooms || []).map(({ _id: roomId, ...room }) => room),
    });
    return res.status(201).json({ data: project });
  } catch (error) { return next(error); }
});

router.post('/:id/share', projectWriteLimit, async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Project not found.' });
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user._id, saved: true });
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    if (!project.shareToken) {
      project.shareToken = randomBytes(24).toString('hex');
      project.sharedAt = new Date();
      await project.save();
    }
    return res.json({ data: { shareToken: project.shareToken, path: `/?share=${project.shareToken}`, sharedAt: project.sharedAt } });
  } catch (error) { return next(error); }
});

router.delete('/:id/share', projectWriteLimit, async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(404).json({ error: 'Project not found.' });
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id, saved: true },
      { $unset: { shareToken: 1, sharedAt: 1 } },
      { new: true },
    );
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    return res.json({ message: 'The shared link has been turned off.' });
  } catch (error) { return next(error); }
});

router.post('/:id/reference', projectWriteLimit, (req, res, next) => referenceUpload.single('image')(req, res, (error) => error ? next(error) : next()), async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid project ID.' });
  if (!req.file) return res.status(400).json({ error: 'Choose a reference photo to upload.' });
  try {
    const project = await Project.findOne({ _id: req.params.id, ownerId: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    const source = await normalizeImage(req.file.buffer);
    const asset = await DesignAsset.create({ ownerId: req.user._id, projectId: project._id, kind: 'reference', contentType: source.contentType, data: source.imageBuffer, byteLength: source.imageBuffer.length });
    if (project.referenceAssetId) await DesignAsset.deleteOne({ _id: project.referenceAssetId, ownerId: req.user._id });
    project.referenceAssetId = asset._id;
    await project.save();
    return res.json({ data: { referenceAssetId: String(asset._id), referenceAssetUrl: `/api/design-assets/${asset._id}` } });
  } catch (error) { return next(error); }
});

router.patch('/:id', projectWriteLimit, async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid project ID.' });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Please check the project details.' });
  try {
    const update = { ...parsed.data };
    if (update.estimateReport) update.estimate = update.estimateReport.expected;
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, ownerId: req.user._id, saved: true },
      { $set: update },
      { new: true, runValidators: true },
    );
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    return res.json({ data: project });
  } catch (error) { return next(error); }
});

router.delete('/:id', projectWriteLimit, async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'Invalid project ID.' });
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, ownerId: req.user._id });
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    await Promise.all([
      DesignAsset.deleteMany({ ownerId: req.user._id, projectId: project._id }),
      PlanTask.deleteMany({ userId: req.user._id, projectId: project._id }),
    ]);
    return res.json({ message: 'Project deleted.' });
  } catch (error) { return next(error); }
});

export default router;
