import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  kind: { type: String, enum: ['text', 'offer'], default: 'text' },
  offer: { type: { type: String, enum: ['cash', 'trade'] }, amount: { type: Number, min: 0 }, itemDescription: { type: String, trim: true, maxlength: 300 } },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });
messageSchema.index({ chatId: 1, createdAt: 1 });
export const Message = mongoose.model('Message', messageSchema);
