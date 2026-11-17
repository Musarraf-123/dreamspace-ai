import { Router } from 'express';
import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import requireAuth from '../middleware/requireAuth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30).lean(),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);
    return res.json({ data: notifications, unreadCount });
  } catch (error) { return next(error); }
});

router.post('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { $set: { read: true } });
    return res.json({ message: 'All notifications marked as read.' });
  } catch (error) { return next(error); }
});

router.patch('/:id/read', async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ error: 'Notification not found.' });
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { read: true } },
      { new: true },
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found.' });
    return res.json({ data: notification });
  } catch (error) { return next(error); }
});

export default router;
