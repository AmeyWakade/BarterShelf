import { Router } from 'express';
import { z } from 'zod';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { Listing } from '../models/Listing.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { Transaction } from '../models/Transaction.js';
import { Report } from '../models/Report.js';
import { DeletionRequest } from '../models/DeletionRequest.js';
import { requireAuth } from '../middleware/auth.js';
import { deleteStoredImages } from './uploads.js';

const router = Router();
const objectId = z.string().regex(/^[0-9a-f]{24}$/i);
const deletionRequestLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

router.delete('/account', requireAuth, async (req, res) => {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const listings = await Listing.find({ ownerId: userId }).select('_id images').lean();
  const listingIds = listings.map(item => item._id);
  const chats = await Chat.find({ participants: userId }).select('_id').lean();
  const chatIds = chats.map(chat => chat._id);
  const messages = await Message.find({ $or: [{ senderId: userId }, { chatId: { $in: chatIds } }] }).select('_id').lean();
  const messageIds = messages.map(message => message._id);

  // Remove remote media before deleting records, so transient storage errors
  // leave the account intact and the user can retry deletion.
  await deleteStoredImages(listings.flatMap(item => item.images ?? []), req.user.id);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Listing.deleteMany({ ownerId: userId }, { session });
      await Message.deleteMany({ $or: [{ senderId: userId }, { chatId: { $in: chatIds } }] }, { session });
      await Chat.deleteMany({ participants: userId }, { session });
      await Transaction.deleteMany({ $or: [{ buyerId: userId }, { sellerId: userId }, { listingId: { $in: listingIds } }] }, { session });
      await Report.deleteMany({ reporterId: userId }, { session });
      await Report.deleteMany({ targetId: { $in: listingIds }, targetType: 'listing' }, { session });
      await Report.deleteMany({ targetId: { $in: messageIds }, targetType: 'chat_message' }, { session });
      await User.updateMany({ blockedUsers: userId }, { $pull: { blockedUsers: userId } }, { session });
      await User.deleteOne({ _id: userId }, { session });
    });
  } finally { await session.endSession(); }
  res.json({ message: 'Your account and associated BarterShelf data have been deleted.' });
});

router.post('/block', requireAuth, async (req, res) => {
  const { userId } = z.object({ userId: objectId }).parse(req.body);
  if (userId.toLowerCase() === req.user.id.toLowerCase()) return res.status(400).json({ error: 'You cannot block your own account.' });
  const target = await User.findById(userId).select('_id');
  if (!target) return res.status(404).json({ error: 'User not found.' });
  await User.updateOne({ _id: req.user.id }, { $addToSet: { blockedUsers: target._id } });
  res.json({ blockedUserId: String(target._id) });
});

router.get('/blocked', requireAuth, async (req, res) => {
  const user = await User.findById(req.user.id).select('blockedUsers').populate('blockedUsers', 'username role vendorVerified').lean();
  res.json({ users: (user?.blockedUsers ?? []).filter(Boolean).map(person => ({ id: String(person._id), username: person.username, role: person.role, vendorVerified: person.vendorVerified })) });
});

router.delete('/block/:userId', requireAuth, async (req, res) => {
  const { userId } = z.object({ userId: objectId }).parse(req.params);
  await User.updateOne({ _id: req.user.id }, { $pull: { blockedUsers: userId } });
  res.status(204).end();
});

// The public form creates a request for manual identity verification. It never
// deletes an account based on an unauthenticated email address alone.
router.post('/deletion-requests', deletionRequestLimiter, async (req, res) => {
  const { email } = z.object({ email: z.email().max(254) }).parse(req.body);
  await DeletionRequest.create({ email: email.toLowerCase() });
  res.status(202).json({ message: 'If an account matches, your deletion request has been received for identity verification.' });
});

router.post('/deletion-requests/web', deletionRequestLimiter, async (req, res) => {
  const parsed = z.object({ email: z.email().max(254) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).type('html').send('<!doctype html><meta name="viewport" content="width=device-width"><h1>Invalid email</h1><p>Enter a valid account email and try again.</p><a href="/delete-account">Back</a>');
  await DeletionRequest.create({ email: parsed.data.email.toLowerCase() });
  res.status(202).type('html').send('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Request received</title><main style="font:16px/1.6 system-ui;max-width:600px;margin:40px auto;padding:20px"><h1>Request received</h1><p>If an account matches, your request is queued for identity verification. Submitting this form does not immediately delete an account.</p><a href="/privacy-policy">Privacy policy</a></main>');
});

export default router;
