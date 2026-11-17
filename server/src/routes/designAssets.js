import { Router } from 'express';
import mongoose from 'mongoose';
import DesignAsset from '../models/DesignAsset.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);
router.get('/:assetId', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.assetId)) return res.status(404).json({ error: 'Image not found.' });
  try {
    const asset = await DesignAsset.findOne({ _id: req.params.assetId, ownerId: req.user._id }).select('+data');
    if (!asset) return res.status(404).json({ error: 'Image not found.' });
    res.set({ 'Content-Type': asset.contentType, 'Content-Length': String(asset.byteLength), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'cross-origin' });
    if (req.query.download === '1') res.set('Content-Disposition', `attachment; filename="dreamspace-${asset.kind}-${asset._id}.jpg"`);
    else res.set('Content-Disposition', 'inline');
    return res.send(asset.data);
  } catch (error) { return next(error); }
});
export default router;
