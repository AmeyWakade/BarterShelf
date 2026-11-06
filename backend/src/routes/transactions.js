import { Router } from 'express';
import { z } from 'zod';
import { Listing } from '../models/Listing.js';
import { Transaction } from '../models/Transaction.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const { listingId, type, days } = z.object({ listingId: z.string().regex(/^[0-9a-f]{24}$/i), type: z.enum(['sale', 'rental']), days: z.number().int().min(1).max(365).optional() }).parse(req.body);
  const listing = await Listing.findOne({ _id: listingId, status: 'active' });
  if (!listing) return res.status(404).json({ error: 'This listing is no longer available.' });
  if (String(listing.ownerId) === String(req.user.id)) return res.status(400).json({ error: 'You cannot transact on your own listing.' });
  if (type === 'rental' && (!listing.transactionTypes.includes('rent') || !listing.rentalDetails)) return res.status(400).json({ error: 'This listing is not available to rent.' });
  if (type === 'sale' && !listing.transactionTypes.some(t => ['buy', 'sell'].includes(t))) return res.status(400).json({ error: 'This listing is not available for purchase.' });
  const amount = type === 'rental' ? listing.rentalDetails.pricePerDay * (days ?? 1) : listing.price;
  const transaction = await Transaction.create({ listingId, buyerId: req.user.id, sellerId: listing.ownerId, type, amount, status: 'pending_pickup' });
  res.status(201).json({ transaction });
});

router.get('/sales', requireAuth, async (req, res) => {
  const [transactions, earnings, counts] = await Promise.all([
    Transaction.find({ sellerId: req.user.id }).populate('listingId', 'title images status').populate('buyerId', 'username').sort({ createdAt: -1 }).limit(100).lean(),
    Transaction.aggregate([{ $match: { sellerId: req.user._id, status: 'completed', type: 'sale' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Transaction.aggregate([{ $match: { sellerId: req.user._id, status: { $in: ['pending_pickup','approved'] } } }, { $group: { _id: '$type', count: { $sum: 1 } } }]),
  ]);
  res.json({ earnings: earnings[0]?.total ?? 0, pendingPickup: counts.reduce((sum, row) => sum + row.count, 0), transactions });
});

router.patch('/:id/approve', requireAuth, async (req,res)=>{
  const transaction=await Transaction.findOneAndUpdate({_id:req.params.id,sellerId:req.user.id,status:'pending_pickup'},{status:'approved'},{new:true});
  if(!transaction)return res.status(404).json({error:'Pickup request not found.'});
  res.json({transaction});
});

router.patch('/:id/complete', requireAuth, async (req, res) => {
  const transaction = await Transaction.findOneAndUpdate({ _id: req.params.id, sellerId: req.user.id, status: 'approved' }, { status: 'completed' }, { new: true });
  if (!transaction) return res.status(404).json({ error: 'Approved pickup not found.' });
  await Listing.findByIdAndUpdate(transaction.listingId, { status: transaction.type === 'sale' ? 'sold' : 'rented' });
  res.json({ transaction });
});

export default router;
