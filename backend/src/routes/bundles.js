import { Router } from 'express';
import { z } from 'zod';
import { Listing } from '../models/Listing.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { haversineKm } from './listings.js';

const router = Router();
const matchSchema = z.object({
  requestedItems: z.array(z.object({ title: z.string().trim().min(1).max(100), category: z.string().trim().max(60).optional() })).min(1).max(30),
  latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(), radius: z.number().min(1).max(10).optional(),
});
const norm = value => value.toLocaleLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().replace(/\s+/g, ' ');
const wordSet = value => new Set(norm(value).split(' ').filter(word => word.length > 1));
function titleScore(request, listing) {
  const wanted = norm(request.title), title = norm(listing.title);
  if (wanted === title) return 1;
  if (title.includes(wanted) || wanted.includes(title)) return 0.88;
  const a = wordSet(wanted), b = wordSet(title);
  const overlap = [...a].filter(word => b.has(word)).length;
  const lexical = overlap / Math.max(a.size, 1);
  const category = request.category && norm(request.category) === norm(listing.category) ? 0.25 : 0;
  return Math.min(0.82, lexical * 0.7 + category);
}

router.post('/bundle-match', requireAuth, async (req, res) => {
  const input = matchSchema.parse(req.body);
  const latitude = input.latitude ?? req.user.location?.latitude;
  const longitude = input.longitude ?? req.user.location?.longitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return res.status(400).json({ error: 'Set your neighborhood location or provide latitude and longitude.' });
  const radiusKm = input.radius ?? req.user.radiusPreference ?? 3;
  const usersBlockingMe = await User.distinct('_id', { blockedUsers: req.user.id });
  const excludedOwners = [...new Set([...(req.user.blockedUsers ?? []).map(String), ...usersBlockingMe.map(String)])];
  const candidates = await Listing.find({ status: 'active', ownerId: { $nin: excludedOwners }, location: { $near: { $geometry: { type: 'Point', coordinates: [longitude, latitude] }, $maxDistance: radiusKm * 1000 } } })
    .populate('ownerId', 'username role vendorVerified location')
    .limit(500).lean();
  const byOwner = new Map();
  for (const listing of candidates) {
    if (!listing.ownerId) continue;
    const key = String(listing.ownerId._id);
    if (!byOwner.has(key)) byOwner.set(key, { owner: listing.ownerId, listings: [] });
    byOwner.get(key).listings.push(listing);
  }
  const matches = [...byOwner.values()].map(group => {
    const selected = [];
    const usedListingIds = new Set();
    for (const request of input.requestedItems) {
      let best = null;
      for (const listing of group.listings) {
        if (usedListingIds.has(String(listing._id))) continue;
        const score = titleScore(request, listing);
        if (score >= 0.25 && (!best || score > best.score)) best = { listing, score };
      }
      if (best) { selected.push({ requestedItem: request, listing: best.listing, score: best.score }); usedListingIds.add(String(best.listing._id)); }
    }
    const coordinates = group.listings[0].location.coordinates;
    return { seller: { id: group.owner._id, username: group.owner.username, role: group.owner.role, vendorVerified: group.owner.vendorVerified }, overlap: selected.length, requestedCount: input.requestedItems.length, matchPercent: Math.round(selected.length / input.requestedItems.length * 100), distanceKm: haversineKm(latitude, longitude, coordinates[1], coordinates[0]), matchedItems: selected };
  }).filter(match => match.overlap > 0).sort((a, b) => b.overlap - a.overlap || b.matchPercent - a.matchPercent || a.distanceKm - b.distanceKm).slice(0, 10);
  res.json({ matches, radiusKm, requestedCount: input.requestedItems.length });
});

export default router;
