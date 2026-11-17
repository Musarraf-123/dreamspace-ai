import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  category: { type: String, enum: ['general', 'design', 'estimate', 'bug', 'idea'], default: 'general' },
  message: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
  status: { type: String, enum: ['new', 'reviewed', 'closed'], default: 'new' },
}, { timestamps: true });

feedbackSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
