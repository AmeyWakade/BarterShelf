import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  participants: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], required: true, validate: v => v.length === 2 },
  lastMessage: { type: String, trim: true, maxlength: 1000, default: '' },
  updatedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true, versionKey: false });
chatSchema.index({ participants: 1, listingId: 1 });
export const Chat = mongoose.model('Chat', chatSchema);
