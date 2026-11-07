import mongoose from 'mongoose';

const deletionRequestSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
  status: { type: String, enum: ['pending', 'verified', 'completed', 'rejected'], default: 'pending', index: true },
}, { timestamps: true, versionKey: false });

deletionRequestSchema.index({ email: 1, createdAt: -1 });
export const DeletionRequest = mongoose.model('DeletionRequest', deletionRequestSchema);
