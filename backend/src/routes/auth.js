import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const registerSchema = z.object({
  username: z.string().trim().min(2).max(40),
  email: z.email().max(254),
  password: z.string().min(10).max(128),
  role: z.enum(['buyer', 'individual_seller', 'vendor']).default('buyer'),
});
const loginSchema = z.object({ email: z.email(), password: z.string().min(1).max(128) });
function issueToken(user) { return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d', issuer: 'bartershelf-api', audience: 'bartershelf-mobile' }); }
function publicUser(user) { return { id: user.id, username: user.username, email: user.email, role: user.role, vendorVerified: user.vendorVerified, location: user.location, radiusPreference: user.radiusPreference }; }

router.post('/register', async (req, res) => {
  const data = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await User.create({ ...data, email: data.email.toLowerCase(), passwordHash, vendorVerified: false });
  res.status(201).json({ token: issueToken(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await User.findOne({ email: data.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
  res.json({ token: issueToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

router.patch('/me', requireAuth, async (req, res) => {
  const schema = z.object({
    location: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), localityName: z.string().trim().max(120).optional() }).optional(),
    radiusPreference: z.number().int().min(1).max(10).optional(),
  }).refine(value => Object.keys(value).length > 0, 'Provide a location or radius preference.');
  const patch = schema.parse(req.body);
  const user = await User.findByIdAndUpdate(req.user.id, { $set: patch }, { new: true, runValidators: true });
  res.json({ user: publicUser(user) });
});

export default router;
