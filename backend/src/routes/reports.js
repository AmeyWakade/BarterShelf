import { Router } from 'express';
import { z } from 'zod';
import { Listing } from '../models/Listing.js';
import { Chat } from '../models/Chat.js';
import { Message } from '../models/Message.js';
import { Report } from '../models/Report.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const inputSchema = z.object({
  targetId: z.string().regex(/^[0-9a-f]{24}$/i),
  targetType: z.enum(['listing', 'chat_message']),
  reason: z.enum(['spam', 'scam', 'inappropriate_content', 'offensive']),
});

router.post('/', requireAuth, async (req, res) => {
  const input = inputSchema.parse(req.body);
  let target;
  if (input.targetType === 'listing') {
    target = await Listing.findOne({ _id: input.targetId, status: 'active' }).select('_id ownerId');
    if (target && String(target.ownerId) === req.user.id) return res.status(400).json({ error: 'You cannot report your own listing.' });
  } else {
    target = await Message.findById(input.targetId).select('_id chatId senderId');
    if (target) {
      const chat = await Chat.findOne({ _id: target.chatId, participants: req.user.id }).select('_id');
      if (!chat) return res.status(404).json({ error: 'Message not found.' });
      if (String(target.senderId) === req.user.id) return res.status(400).json({ error: 'You cannot report your own message.' });
    }
  }
  if (!target) return res.status(404).json({ error: 'Content not found.' });
  const report = await Report.create({ ...input, reporterId: req.user.id });
  await (input.targetType === 'listing' ? Listing.updateOne({ _id: target._id }, { $set: { isReported: true } }) : Message.updateOne({ _id: target._id }, { $set: { isReported: true } }));
  res.status(201).json({ reportId: report.id, status: report.status });
});

export default router;
