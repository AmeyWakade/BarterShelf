import { Router } from 'express';
import { z } from 'zod';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { Listing } from '../models/Listing.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const memberFilter = (chatId, userId) => ({ _id: chatId, participants: userId });
async function blockedInChat(chat, user) {
  const otherId = chat.participants.find(id => String(id) !== String(user.id));
  if (!otherId) return true;
  if ((user.blockedUsers ?? []).some(id => String(id) === String(otherId))) return true;
  return Boolean(await User.exists({ _id: otherId, blockedUsers: user.id }));
}

router.get('/', requireAuth, async (req, res) => {
  const usersBlockingMe = await User.distinct('_id', { blockedUsers: req.user.id });
  const excludedOwners = [...new Set([...(req.user.blockedUsers ?? []).map(String), ...usersBlockingMe.map(String)])];
  const chats = await Chat.find({ $and: [{ participants: req.user.id }, { participants: { $nin: excludedOwners } }] }).populate('listingId', 'title images status ownerId').populate('participants', 'username role vendorVerified').sort({ updatedAt: -1 }).limit(100).lean();
  res.json({ chats });
});

router.post('/', requireAuth, async (req, res) => {
  const { listingId } = z.object({ listingId: z.string().regex(/^[0-9a-f]{24}$/i) }).parse(req.body);
  const listing = await Listing.findOne({ _id: listingId, status: 'active' });
  if (!listing) return res.status(404).json({ error: 'Listing is no longer available.' });
  if (String(listing.ownerId) === String(req.user.id)) return res.status(400).json({ error: 'You cannot start a chat on your own listing.' });
  const owner = await User.findById(listing.ownerId).select('blockedUsers');
  if ((req.user.blockedUsers ?? []).some(id => String(id) === String(listing.ownerId)) || owner?.blockedUsers?.some(id => String(id) === req.user.id)) return res.status(403).json({ error: 'Messaging is unavailable between these accounts.' });
  let chat = await Chat.findOne({ listingId, participants: { $all: [req.user.id, listing.ownerId] } });
  if (!chat) chat = await Chat.create({ listingId, participants: [req.user.id, listing.ownerId] });
  const populated = await Chat.findById(chat.id).populate('listingId', 'title images status ownerId').populate('participants', 'username role vendorVerified').lean();
  res.status(201).json({ chat: populated });
});

router.get('/:id/messages', requireAuth, async (req, res) => {
  const chat = await Chat.findOne(memberFilter(req.params.id, req.user.id)).select('_id participants');
  if (!chat) return res.status(404).json({ error: 'Conversation not found.' });
  if (await blockedInChat(chat, req.user)) return res.status(403).json({ error: 'Messaging is unavailable between these accounts.' });
  const messages = await Message.find({ chatId: chat.id }).sort({ createdAt: 1 }).limit(500).populate('senderId', 'username').lean();
  res.json({ messages });
});

router.post('/:id/messages', requireAuth, async (req, res) => {
  const chat = await Chat.findOne(memberFilter(req.params.id, req.user.id));
  if (!chat) return res.status(404).json({ error: 'Conversation not found.' });
  if (await blockedInChat(chat, req.user)) return res.status(403).json({ error: 'Messaging is unavailable between these accounts.' });
  const input = z.object({ text: z.string().trim().min(1).max(2000), kind: z.enum(['text', 'offer']).default('text'), offer: z.object({ type: z.enum(['cash', 'trade']), amount: z.number().min(0).optional(), itemDescription: z.string().trim().max(300).optional() }).optional() }).parse(req.body);
  if (input.kind === 'offer' && !input.offer) return res.status(400).json({ error: 'Add cash or trade details to the offer.' });
  const message = await Message.create({ ...input, chatId: chat.id, senderId: req.user.id });
  chat.lastMessage = input.kind === 'offer' ? `Offer: ${input.text}` : input.text;
  chat.updatedAt = new Date(); await chat.save();
  res.status(201).json({ message });
});

export default router;
