import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import Project from '../models/Project.js';
import DesignAsset from '../models/DesignAsset.js';

const router = Router();
const shareLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many shared-link requests. Please try again shortly.' },
});
router.use(shareLimit);

function publicProject(project, ownerName) {
  return {
    id: String(project._id),
    title: project.title,
    type: project.type,
    room: project.room,
    roomType: project.roomType,
    style: project.style,
    palette: project.palette,
    budget: project.budget,
    layout: project.layout,
    doors: project.doors,
    windows: project.windows,
    measurements: project.measurements,
    estimateReport: project.estimateReport,
    rooms: project.rooms,
    ownerName: ownerName || 'A DreamSpace user',
    sharedAt: project.sharedAt,
    createdAt: project.createdAt,
    imageIds: {
      generated: project.generations?.at(-1)?.generatedAssetId || null,
      original: project.generations?.at(-1)?.originalAssetId || null,
      reference: project.referenceAssetId || null,
    },
  };
}

async function findSharedProject(token) {
  if (!/^[a-f\d]{24,64}$/i.test(token)) return null;
  return Project.findOne({ shareToken: token, saved: true }).populate('ownerId', 'name').lean();
}

router.get('/projects/:token', async (req, res, next) => {
  try {
    const project = await findSharedProject(req.params.token);
    if (!project) return res.status(404).json({ error: 'This shared design link is no longer available.' });
    return res.json({ data: publicProject(project, project.ownerId?.name) });
  } catch (error) { return next(error); }
});

router.get('/projects/:token/assets/:assetId', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.assetId)) return res.status(404).json({ error: 'Image not found.' });
    const project = await findSharedProject(req.params.token);
    if (!project) return res.status(404).json({ error: 'This shared design link is no longer available.' });
    const allowed = new Set([
      String(project.referenceAssetId || ''),
      String(project.sourceAssetId || ''),
      ...(project.generations || []).flatMap((generation) => [String(generation.generatedAssetId), String(generation.originalAssetId)]),
    ]);
    if (!allowed.has(String(req.params.assetId))) return res.status(404).json({ error: 'Image not found.' });
    const asset = await DesignAsset.findOne({ _id: req.params.assetId, projectId: project._id }).select('+data');
    if (!asset) return res.status(404).json({ error: 'Image not found.' });
    res.set({ 'Content-Type': asset.contentType, 'Content-Length': String(asset.byteLength), 'Cache-Control': 'public, max-age=60', 'X-Content-Type-Options': 'nosniff' });
    return res.send(asset.data);
  } catch (error) { return next(error); }
});

export default router;
