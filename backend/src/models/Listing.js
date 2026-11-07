import mongoose from 'mongoose';

const rentalSchema = new mongoose.Schema({
  pricePerDay: { type: Number, min: 0, required: true },
  securityDeposit: { type: Number, min: 0, default: 0 },
}, { _id: false });

const listingSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  category: { type: String, required: true, trim: true, maxlength: 60 },
  conditionType: { type: String, enum: ['first_hand', 'second_hand'], required: true },
  transactionTypes: { type: [{ type: String, enum: ['buy', 'sell', 'swap', 'rent'] }], required: true, validate: { validator: v => v.length > 0, message: 'Select at least one transaction type.' } },
  price: { type: Number, min: 0, default: 0 },
  rentalDetails: { type: rentalSchema, default: undefined },
  images: { type: [{ type: String, maxlength: 2048 }], default: [], validate: { validator: v => v.length <= 4, message: 'A listing can have at most four images.' } },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: { type: [Number], required: true, validate: { validator: v => v.length === 2 && v[0] >= -180 && v[0] <= 180 && v[1] >= -90 && v[1] <= 90, message: 'Coordinates must be [longitude, latitude].' } },
  },
  localityName: { type: String, trim: true, maxlength: 120, default: '' },
  status: { type: String, enum: ['active', 'sold', 'rented', 'inactive'], default: 'active', index: true },
  isReported: { type: Boolean, default: false, index: true },
}, { timestamps: true, versionKey: false });

listingSchema.index({ location: '2dsphere' });
listingSchema.index({ status: 1, category: 1, transactionTypes: 1, createdAt: -1 });
export const Listing = mongoose.model('Listing', listingSchema);
