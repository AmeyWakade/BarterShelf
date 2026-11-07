import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema({
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  localityName: { type: String, trim: true, maxlength: 120 },
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['buyer', 'individual_seller', 'vendor'], default: 'buyer', required: true },
  vendorVerified: { type: Boolean, default: false },
  location: { type: pointSchema, default: undefined },
  radiusPreference: { type: Number, min: 1, max: 10, default: 3 },
  blockedUsers: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
}, { timestamps: true, versionKey: false });

userSchema.set('toJSON', { transform: (_doc, ret) => { delete ret.passwordHash; return ret; } });
export const User = mongoose.model('User', userSchema);
