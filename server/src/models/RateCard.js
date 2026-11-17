import mongoose from 'mongoose';

const rateCardSchema = new mongoose.Schema({
  key: { type: String, required: true, trim: true, maxlength: 40 },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  kind: { type: String, enum: ['material', 'labour', 'service'], required: true },
  unit: { type: String, required: true, trim: true, maxlength: 40 },
  city: { type: String, required: true, trim: true, maxlength: 60 },
  quality: { type: String, enum: ['Basic', 'Standard', 'Premium'], required: true },
  rate: { type: Number, required: true, min: 0 },
  lowFactor: { type: Number, required: true, min: 0.5, max: 1 },
  highFactor: { type: Number, required: true, min: 1, max: 2 },
  effectiveDate: { type: String, required: true, maxlength: 10 },
  source: { type: String, required: true, trim: true, maxlength: 160 },
}, { timestamps: true });

rateCardSchema.index({ city: 1, quality: 1, key: 1 }, { unique: true });

export default mongoose.models.RateCard || mongoose.model('RateCard', rateCardSchema);
