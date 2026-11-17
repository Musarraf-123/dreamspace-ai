import mongoose from 'mongoose';

const materialSchema = new mongoose.Schema({
  sku: { type: String, required: true, trim: true, maxlength: 60, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  brand: { type: String, required: true, trim: true, maxlength: 80 },
  category: { type: String, required: true, trim: true, maxlength: 40 },
  unit: { type: String, required: true, trim: true, maxlength: 40 },
  tier: { type: String, enum: ['Basic', 'Standard', 'Premium'], required: true },
  rate: { type: Number, required: true, min: 0 },
  effectiveDate: { type: String, required: true, maxlength: 10 },
  source: { type: String, required: true, trim: true, maxlength: 160 },
}, { timestamps: true });

export default mongoose.models.Material || mongoose.model('Material', materialSchema);
