import mongoose from 'mongoose';

const designAssetSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  kind: { type: String, enum: ['original', 'generated', 'reference'], required: true },
  contentType: { type: String, enum: ['image/jpeg', 'image/png', 'image/webp'], required: true },
  byteLength: { type: Number, required: true, min: 1, max: 12 * 1024 * 1024 },
  data: { type: Buffer, required: true, select: false },
}, { timestamps: true });

designAssetSchema.index({ ownerId: 1, projectId: 1, kind: 1, createdAt: -1 });

export default mongoose.models.DesignAsset || mongoose.model('DesignAsset', designAssetSchema);
