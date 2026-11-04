import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import listingRoutes from './routes/listings.js';
import bundleRoutes from './routes/bundles.js';
import transactionRoutes from './routes/transactions.js';
import uploadRoutes from './routes/uploads.js';
import chatRoutes from './routes/chats.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set. Copy backend/.env.example to backend/.env and configure it.');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');

const origins = (process.env.CORS_ORIGINS ?? '*').split(',').map(value => value.trim());
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: origins.includes('*') ? true : origins, credentials: true, maxAge: 86400 }));
app.use(express.json({ limit: '1mb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
app.get('/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api', bundleRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/chats', chatRoutes);
app.use(notFound);
app.use(errorHandler);

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
const server = app.listen(port, '0.0.0.0', () => console.info(`BarterShelf API listening on port ${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { server.close(); await mongoose.disconnect(); process.exit(0); });
