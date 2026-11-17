import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import mongoose from 'mongoose';
import multer from 'multer';
import { z } from 'zod';
import Project from '../models/Project.js';
import DesignAsset from '../models/DesignAsset.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import requireAuth from '../middleware/requireAuth.js';
import { normalizeGeneratedImage, normalizeImage } from '../services/imageProcessing.js';
import { generateRedesign, IMAGE_MODEL } from '../services/openaiImageEdit.js';
import { analyzeSpace } from '../services/spaceAnalysis.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 7, parts: 8, fieldSize: 2048 }, fileFilter: (_req, file, callback) => {
  if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) return callback(null, true);
  const error = new Error('Upload a JPG, PNG or WebP image.'); error.status = 400; return callback(error);
} });
const fields = z.object({
  mode: z.enum(['interior', 'exterior', '3d']),
  roomType: z.string().trim().min(2).max(80),
  style: z.string().trim().min(2).max(60),
  palette: z.string().trim().min(2).max(60),
  budget: z.string().trim().min(2).max(40),
  instructions: z.string().trim().max(1500).optional().default(''),
  layout: z.string().trim().max(40).optional().default(''),
  doors: z.coerce.number().int().min(0).max(20).optional(),
  windows: z.coerce.number().int().min(0).max(20).optional(),
  projectId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
}).strict();
const generationLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => String(req.user._id), message: { error: 'You have reached the hourly design limit. Please try again later.' } });
const analysisLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, keyGenerator: (req) => String(req.user._id), message: { error: 'You have reached the hourly space-analysis limit. Please try again later.' } });

router.post('/analyze', requireAuth, analysisLimit, (req, res, next) => upload.single('image')(req, res, (error) => error ? next(error) : next()), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Upload a photo to analyse.' });
  try {
    const source = await normalizeImage(req.file.buffer);
    const analysis = await analyzeSpace({ imageBuffer: source.imageBuffer });
    return res.json({ data: analysis });
  } catch (error) { return next(error); }
});

router.post('/', requireAuth, generationLimit, (req, res, next) => upload.single('image')(req, res, (error) => error ? next(error) : next()), async (req, res, next) => {
  const parsed = fields.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Check your design choices and try again.' });
  if (!req.file) return res.status(400).json({ error: 'Upload a photo of your space to create a redesign.' });
  let project;
  let createdProject = false;
  const assetIds = [];
  try {
    const values = parsed.data;
    const source = await normalizeImage(req.file.buffer);
    if (values.projectId) {
      project = await Project.findOne({ _id: values.projectId, ownerId: req.user._id });
      if (!project) return res.status(404).json({ error: 'Project not found.' });
    } else {
      project = await Project.create({ ownerId: req.user._id, title: `${values.roomType} — ${values.style}`, type: values.mode, room: values.roomType, roomType: values.roomType, style: values.style, palette: values.palette, budget: values.budget, layout: values.layout, doors: values.doors, windows: values.windows, prompt: values.instructions, saved: false, status: 'processing' });
      createdProject = true;
    }
    const original = await DesignAsset.create({ ownerId: req.user._id, projectId: project._id, kind: 'original', contentType: source.contentType, data: source.imageBuffer, byteLength: source.imageBuffer.length });
    assetIds.push(original._id);
    const generator = req.app.locals.imageGenerator || generateRedesign;
    const result = await generator({ imageBuffer: source.imageBuffer, ...values, userId: req.user._id });
    if (!await User.exists({ _id: req.user._id })) {
      const error = new Error('The account was deleted while this image was processing.'); error.status = 401; error.publicMessage = 'This account has been deleted. The unfinished design was discarded.'; throw error;
    }
    const generatedImage = await normalizeGeneratedImage(result.imageBuffer);
    const generated = await DesignAsset.create({ ownerId: req.user._id, projectId: project._id, kind: 'generated', contentType: generatedImage.contentType, data: generatedImage.imageBuffer, byteLength: generatedImage.imageBuffer.length });
    assetIds.push(generated._id);
    project.type = values.mode; project.room = values.roomType; project.roomType = values.roomType; project.style = values.style; project.palette = values.palette; project.budget = values.budget; project.layout = values.layout; project.doors = values.doors; project.windows = values.windows; project.prompt = values.instructions; project.sourceAssetId = original._id; project.status = 'complete';
    project.generations.push({ mode: values.mode, roomType: values.roomType, style: values.style, palette: values.palette, budget: values.budget, layout: values.layout, doors: values.doors, windows: values.windows, instructions: values.instructions, originalAssetId: original._id, generatedAssetId: generated._id, model: result.model || IMAGE_MODEL });
    await project.save();
    if (!await User.exists({ _id: req.user._id })) {
      const error = new Error('The account was deleted while this image was processing.'); error.status = 401; error.publicMessage = 'This account has been deleted. The unfinished design was discarded.'; throw error;
    }
    const generation = project.generations.at(-1);
    await Notification.create({
      userId: req.user._id,
      type: 'design',
      title: `Your ${values.roomType} redesign is ready`,
      message: `${values.style} · ${values.palette} · ${values.budget}`,
      link: `/?project=${project._id}`,
    }).catch(() => {});
    return res.status(values.projectId ? 200 : 201).json({ data: { projectId: String(project._id), generationId: String(generation._id), originalAssetId: String(original._id), generatedAssetId: String(generated._id), originalAssetUrl: `/api/design-assets/${original._id}`, generatedAssetUrl: `/api/design-assets/${generated._id}`, model: generation.model, saved: project.saved } });
  } catch (error) {
    if (assetIds.length) await DesignAsset.deleteMany({ _id: { $in: assetIds }, ownerId: req.user._id }).catch(() => {});
    if (createdProject && project) await Project.deleteOne({ _id: project._id, ownerId: req.user._id }).catch(() => {});
    return next(error);
  }
});

export default router;
