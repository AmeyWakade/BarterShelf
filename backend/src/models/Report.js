import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema({
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
  targetType: { type: String, enum: ['listing', 'chat_message'], required: true },
  reason: { type: String, enum: ['spam', 'scam', 'inappropriate_content', 'offensive'], required: true },
  status: { type: String, enum: ['pending', 'reviewed', 'dismissed'], default: 'pending', index: true },
}, { timestamps: true, versionKey: false });

reportSchema.index({ reporterId: 1, targetId: 1, targetType: 1 }, { unique: true });
export const Report = mongoose.model('Report', reportSchema);
