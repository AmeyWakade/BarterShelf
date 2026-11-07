import { Router } from 'express';
import { z } from 'zod';
import { Listing } from '../models/Listing.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const listingInput = z.object({
  title: z.string().trim().min(2).max(100), description: z.string().trim().max(2000).optional().default(''),
  category: z.string().trim().min(1).max(60), conditionType: z.enum(['first_hand', 'second_hand']),
  transactionTypes: z.array(z.enum(['buy', 'sell', 'swap', 'rent'])).min(1),
  price: z.number().finite().min(0).optional().default(0),
  rentalDetails: z.object({ pricePerDay: z.number().finite().min(0), securityDeposit: z.number().finite().min(0).optional().default(0) }).optional(),
  images: z.array(z.string().url().max(2048)).max(4).optional().default([]),
  location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), localityName: z.string().trim().max(120).optional().default('') }),
}).superRefine((item, context) => {
  if (item.transactionTypes.includes('rent') && !item.rentalDetails) context.addIssue({ code: 'custom', message: 'Rental listings need a daily price.', path: ['rentalDetails'] });
});
const queryNumber = (value, fallback, min, max) => { const n = Number(value ?? fallback); return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback; };

router.post('/', requireAuth, async (req, res) => {
  const batch = Array.isArray(req.body) ? req.body : [req.body];
  const maxBatch = Number(process.env.MAX_LISTING_BATCH ?? 50);
  if (!batch.length || batch.length > maxBatch) return res.status(400).json({ error: `Submit between 1 and ${maxBatch} listings per batch.` });
  const inputs = batch.map((value, index) => { try { return listingInput.parse(value); } catch (error) { error.message = `Listing ${index + 1}: ${error.message}`; throw error; } });
  const docs = inputs.map(item => ({ ...item, ownerId: req.user.id, location: { type: 'Point', coordinates: [item.location.longitude, item.location.latitude] }, localityName: item.location.localityName }));
  const listings = await Listing.insertMany(docs, { ordered: true });
  res.status(201).json({ listings, count: listings.length });
});

router.get('/nearby', requireAuth, async (req, res) => {
  const lat = Number(req.query.lat ?? req.user.location?.latitude);
  const lng = Number(req.query.lng ?? req.user.location?.longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) return res.status(400).json({ error: 'Provide valid lat and lng coordinates.' });
  const radiusKm = queryNumber(req.query.radius, req.user.radiusPreference, 1, 10);
  const usersBlockingMe = await User.distinct('_id', { blockedUsers: req.user.id });
  const excludedOwners = [...new Set([...(req.user.blockedUsers ?? []).map(String), ...usersBlockingMe.map(String)])];
  const filter = { status: 'active', ownerId: { $nin: excludedOwners }, location: { $near: { $geometry: { type: 'Point', coordinates: [lng, lat] }, $maxDistance: radiusKm * 1000 } } };
  if (['first_hand', 'second_hand'].includes(req.query.condition)) filter.conditionType = req.query.condition;
  if (['buy', 'sell', 'swap', 'rent'].includes(req.query.transactionType)) filter.transactionTypes = req.query.transactionType;
  if (typeof req.query.category === 'string' && req.query.category.trim()) filter.category = req.query.category.trim();
  if (typeof req.query.q === 'string' && req.query.q.trim()) {
    const escaped = req.query.q.trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(escaped, 'i');
    filter.$or = [{ title: pattern }, { category: pattern }, { description: pattern }];
  }
  const results = await Listing.find(filter).populate('ownerId', 'username role vendorVerified').limit(queryNumber(req.query.limit, 60, 1, 100)).lean();
  res.json({ listings: results.map(item => ({ ...item, distanceKm: haversineKm(lat, lng, item.location.coordinates[1], item.location.coordinates[0]) })), radiusKm });
});

router.get('/mine', requireAuth, async (req, res) => {
  const listings = await Listing.find({ ownerId: req.user.id }).sort({ createdAt: -1 }).lean();
  res.json({ listings });
});

router.get('/:id', requireAuth, async (req, res) => {
  const usersBlockingMe = await User.distinct('_id', { blockedUsers: req.user.id });
  const excludedOwners = [...new Set([...(req.user.blockedUsers ?? []).map(String), ...usersBlockingMe.map(String)])];
  const listing = await Listing.findOne({ _id: req.params.id, status: 'active', ownerId: { $nin: excludedOwners } }).populate('ownerId', 'username role vendorVerified').lean();
  if (!listing) return res.status(404).json({ error: 'Listing is no longer available.' });
  res.json({ listing });
});

router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = z.object({ status: z.enum(['active', 'sold', 'rented', 'inactive']) }).parse(req.body);
  const listing = await Listing.findOneAndUpdate({ _id: req.params.id, ownerId: req.user.id }, { status }, { new: true, runValidators: true });
  if (!listing) return res.status(404).json({ error: 'Listing not found.' });
  res.json({ listing });
});

router.patch('/mine/preferences', requireAuth, async (req, res) => {
  const { radiusPreference } = z.object({ radiusPreference: z.number().int().min(1).max(10) }).parse(req.body);
  req.user.radiusPreference = radiusPreference;
  await req.user.save();
  res.json({ radiusPreference: req.user.radiusPreference });
});

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = value => value * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default router;
