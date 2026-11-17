import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254, unique: true },
  city: { type: String, trim: true, maxlength: 80, default: 'Pune' },
  preferredStyle: { type: String, trim: true, maxlength: 60, default: 'Warm minimal' },
  passwordHash: { type: String, select: false },
  googleId: { type: String, trim: true, unique: true, sparse: true },
  authProvider: { type: String, enum: ['email', 'google'], default: 'email' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  termsVersion: { type: String, required: true, default: 'draft-2026-11' },
  termsAcceptedAt: { type: Date, required: true, default: Date.now },
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (_document, result) => {
    delete result.passwordHash;
    delete result.__v;
    return result;
  },
});

export default mongoose.models.User || mongoose.model('User', userSchema);
