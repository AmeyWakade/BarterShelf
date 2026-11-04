import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, index: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['sale', 'rental'], required: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['completed', 'pending_pickup'], default: 'pending_pickup', index: true },
}, { timestamps: true, versionKey: false });

transactionSchema.index({ sellerId: 1, status: 1, createdAt: -1 });
export const Transaction = mongoose.model('Transaction', transactionSchema);
