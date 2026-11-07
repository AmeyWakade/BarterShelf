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
import uploadRoutes, { localUploadsDirectory } from './routes/uploads.js';
import chatRoutes from './routes/chats.js';
import userRoutes from './routes/users.js';
import reportRoutes from './routes/reports.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI must be set. Copy backend/.env.example to backend/.env and configure it.');
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters.');

const origins = (process.env.CORS_ORIGINS ?? '*').split(',').map(value => value.trim());
const privacyPolicyHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>BarterShelf Privacy Policy</title><style>body{font:16px/1.65 system-ui,sans-serif;max-width:760px;margin:0 auto;padding:28px 20px;color:#17251c;background:#f7f8f3}h1,h2{line-height:1.2}a{color:#28613d}.card{background:white;border-radius:18px;padding:24px;margin:18px 0}</style><main><h1>BarterShelf Privacy Policy</h1><p>Last updated: November 7, 2026</p><section class="card"><h2>Information we collect</h2><p>BarterShelf stores account details (username, email, password hash, role), listings and their photos, messages and offers, reports, and transaction request records. Passwords are stored as one-way hashes.</p><h2>Location</h2><p>With your permission, the app uses your device location to find listings within your chosen neighborhood radius. Coordinates support nearby search and are not displayed publicly on listing cards. You can withhold or revoke location permission in your device settings.</p><h2>Camera and photos</h2><p>Camera and photo library access are requested only when you choose to take or select listing photos. Selected photos are uploaded to our image storage provider and displayed with your listing.</p><h2>How information is used and shared</h2><p>We use information to operate local discovery, listings, chats, safety reports, and requested pickups or rentals. Your public profile name, listing details, approximate locality, and listing photos can be seen by other users. We do not sell personal information. Infrastructure providers may process data to operate the service.</p><h2>Retention and deletion</h2><p>Account data is retained while your account is active. You can delete your account in the app or request deletion at <a href="/delete-account">our account deletion page</a>. Deletion removes your profile, listings, associated photos, chats, and related records, subject to limited retention required by law or to resolve abuse and security issues. Web requests are identity-verified before deletion.</p><h2>Security and contact</h2><p>We use access controls and encrypted connections where supported. For privacy questions, contact the BarterShelf support team through the app store listing or the service operator.</p></section><p><a href="/delete-account">Request account deletion</a></p></main></html>`;
const deleteAccountHtml = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Delete your BarterShelf account</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:620px;margin:0 auto;padding:28px 20px;color:#17251c;background:#f7f8f3}main{background:white;border-radius:18px;padding:24px}input,button{box-sizing:border-box;width:100%;padding:13px;border-radius:10px;font:inherit}input{border:1px solid #b6c2b8;margin:8px 0 16px}button{border:0;background:#28613d;color:white;font-weight:700}</style><main><h1>Request account deletion</h1><p>If you can sign in, delete your account in BarterShelf under Profile → Delete account for immediate removal. If you cannot sign in, submit the account email below. We will verify ownership before processing; an email address alone never authorizes deletion.</p><form method="post" action="/api/users/deletion-requests/web"><label for="email">Account email</label><input id="email" name="email" type="email" maxlength="254" autocomplete="email" required><button type="submit">Submit deletion request</button></form><p>Submitting a request does not delete the account immediately. For privacy details, read our <a href="/privacy-policy">Privacy Policy</a>.</p></main></html>`;
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: origins.includes('*') ? true : origins, credentials: true, maxAge: 86400 }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
if (process.env.NODE_ENV === 'development') app.use('/uploads', express.static(localUploadsDirectory, { immutable: true, index: false, maxAge: '1d' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false }));
app.get('/health', (_req, res) => res.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }));
function sendLegalPage(res, html) {
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.type('html').send(html);
}
app.get('/privacy-policy', (_req, res) => sendLegalPage(res, privacyPolicyHtml));
app.get('/delete-account', (_req, res) => sendLegalPage(res, deleteAccountHtml));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
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
