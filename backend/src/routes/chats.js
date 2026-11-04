import { Router } from 'express';
import { z } from 'zod';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { Listing } from '../models/Listing.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const memberFilter = (chatId, userId) => ({ _id: chatId, participants: userId });

router.get('/', requireAuth, async (req, res) => {
  const chats = await Chat.find({ participants: req.user.id }).populate('listingId', 'title images status ownerId').populate('participants', 'username role vendorVerified').sort({ updatedAt: -1 }).limit(100).lean();
  res.json({ chats });
});

router.post('/', requireAuth, async (req, res) => {
  const { listingId } = z.object({ listingId: z.string().regex(/^[0-9a-f]{24}$/i) }).parse(req.body);
  const listing = await Listing.findOne({ _id: listingId, status: 'active' });
  if (!listing) return res.status(404).json({ error: 'Listing is no longer available.' });
  if (String(listing.ownerId) === String(req.user.id)) return res.status(400).json({ error: 'You cannot start a chat on your own listing.' });
  let chat = await Chat.findOne({ listingId, participants: { $all: [req.user.id, listing.ownerId] } });
  if (!chat) chat = await Chat.create({ listingId, participants: [req.user.id, listing.ownerId] });
  const populated = await Chat.findById(chat.id).populate('listingId', 'title images status ownerId').populate('participants', 'username role vendorVerified').lean();
  res.status(201).json({ chat: populated });
});

router.get('/:id/messages', requireAuth, async (req, res) => {
  const chat = await Chat.findOne(memberFilter(req.params.id, req.user.id)).select('_id');
  if (!chat) return res.status(404).json({ error: 'Conversation not found.' });
  const messages = await Message.find({ chatId: chat.id }).sort({ createdAt: 1 }).limit(500).populate('senderId', 'username').lean();
  res.json({ messages });
});

router.post('/:id/messages', requireAuth, async (req, res) => {
  const chat = await Chat.findOne(memberFilter(req.params.id, req.user.id));
  if (!chat) return res.status(404).json({ error: 'Conversation not found.' });
  const input = z.object({ text: z.string().trim().min(1).max(2000), kind: z.enum(['text', 'offer']).default('text'), offer: z.object({ type: z.enum(['cash', 'trade']), amount: z.number().min(0).optional(), itemDescription: z.string().trim().max(300).optional() }).optional() }).parse(req.body);
  if (input.kind === 'offer' && !input.offer) return res.status(400).json({ error: 'Add cash or trade details to the offer.' });
  const message = await Message.create({ ...input, chatId: chat.id, senderId: req.user.id });
  chat.lastMessage = input.kind === 'offer' ? `Offer: ${input.text}` : input.text;
  chat.updatedAt = new Date(); await chat.save();
  res.status(201).json({ message });
});

export default router;
