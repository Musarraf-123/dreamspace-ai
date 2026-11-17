import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['design', 'estimate', 'enquiry', 'planner', 'system'], default: 'system' },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, trim: true, maxlength: 400 },
  link: { type: String, trim: true, maxlength: 300 },
  read: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
