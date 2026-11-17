import mongoose from 'mongoose';

const enquirySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  phone: { type: String, required: true, trim: true, minlength: 7, maxlength: 20 },
  city: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  message: { type: String, required: true, trim: true, minlength: 5, maxlength: 1000 },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' },
}, { timestamps: true });

export default mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema);
