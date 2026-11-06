import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
export const localUploadsDirectory = fileURLToPath(new URL('../../uploads/', import.meta.url));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, done) => file.mimetype.startsWith('image/') ? done(null, true) : done(new Error('Only image files are accepted.')),
});
let cloudinaryClient;

function cloudinaryCredentials() {
  const raw = process.env.CLOUDINARY_URL?.trim();
  if (!raw) return process.env.NODE_ENV === 'development' ? { local: true } : null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'cloudinary:' || !parsed.username || !parsed.password || !parsed.hostname) return null;
    return { api_key: decodeURIComponent(parsed.username), api_secret: decodeURIComponent(parsed.password), cloud_name: parsed.hostname };
  } catch {
    return null;
  }
}

async function getCloudinaryClient(credentials) {
  if (cloudinaryClient) return cloudinaryClient;
  // The SDK parses CLOUDINARY_URL as soon as it loads. Temporarily remove the
  // raw value so a bad local setting cannot prevent the whole API from starting.
  const raw = process.env.CLOUDINARY_URL;
  delete process.env.CLOUDINARY_URL;
  try {
    const loaded = await import('cloudinary');
    cloudinaryClient = loaded.v2 ?? loaded.default.v2;
    cloudinaryClient.config(credentials);
  } finally {
    if (raw === undefined) delete process.env.CLOUDINARY_URL;
    else process.env.CLOUDINARY_URL = raw;
  }
  return cloudinaryClient;
}

async function uploadImage(buffer, userId, credentials, file, req) {
  if (credentials.local) return uploadLocally(file, req);
  const cloudinary = await getCloudinaryClient(credentials);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `bartershelf/${userId}`, resource_type: 'image', transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] }, (error, result) => error ? reject(error) : resolve(result.secure_url));
    stream.end(buffer);
  });
}

async function uploadLocally(file, req) {
  const extensions = { 'image/avif': 'avif', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const extension = extensions[file.mimetype];
  if (!extension) throw new Error('Local photo uploads support JPEG, PNG, GIF, WebP, HEIC, and AVIF images.');

  const filename = `${randomUUID()}.${extension}`;
  await mkdir(localUploadsDirectory, { recursive: true });
  await writeFile(path.join(localUploadsDirectory, filename), file.buffer, { flag: 'wx' });
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

router.post('/images', requireAuth, (req, res, next) => {
  const credentials = cloudinaryCredentials();
  if (!credentials) return res.status(503).json({ error: 'Image hosting is unavailable. Set CLOUDINARY_URL to cloudinary://API_KEY:API_SECRET@CLOUD_NAME in the backend environment.' });
  upload.array('images', 4)(req, res, async error => {
    if (error) return next(error);
    try {
      if (!req.files?.length) return res.status(400).json({ error: 'Select at least one image.' });
      const images = await Promise.all(req.files.map(file => uploadImage(file.buffer, req.user.id, credentials, file, req)));
      res.status(201).json({ images });
    } catch (uploadError) { next(uploadError); }
  });
});

export default router;
