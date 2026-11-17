import mongoose from 'mongoose';

const planTaskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  phase: { type: String, enum: ['planning', 'design', 'procurement', 'execution', 'handover'], default: 'planning' },
  done: { type: Boolean, default: false },
  dueDate: { type: Date },
  order: { type: Number, default: 0 },
}, { timestamps: true });

planTaskSchema.index({ userId: 1, phase: 1, order: 1 });

export default mongoose.models.PlanTask || mongoose.model('PlanTask', planTaskSchema);
