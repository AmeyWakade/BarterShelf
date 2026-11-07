import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
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
  if (!raw || raw.includes('<your_api_key>') || raw.includes('YOUR_API_KEY')) return process.env.NODE_ENV === 'development' ? { local: true } : null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'cloudinary:' || !parsed.username || !parsed.password || !parsed.hostname) {
      return process.env.NODE_ENV === 'development' ? { local: true } : null;
    }
    return { api_key: decodeURIComponent(parsed.username), api_secret: decodeURIComponent(parsed.password), cloud_name: parsed.hostname };
  } catch {
    return process.env.NODE_ENV === 'development' ? { local: true } : null;
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

export async function deleteStoredImages(urls, ownerId) {
  const uniqueUrls = [...new Set(urls)].filter(value => typeof value === 'string');
  const localFiles = [];
  const publicIds = [];
  for (const value of uniqueUrls) {
    let url;
    try { url = new URL(value); } catch { continue; }
    const localPrefix = `/uploads/${ownerId}/`;
    if (url.pathname.startsWith(localPrefix)) {
      const filename = url.pathname.slice(localPrefix.length);
      if (/^[0-9a-f-]{36}\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(filename)) localFiles.push(path.join(localUploadsDirectory, ownerId, filename));
      continue;
    }
    const marker = '/image/upload/';
    const markerIndex = url.pathname.indexOf(marker);
    if (markerIndex < 0) continue;
    const pathParts = url.pathname.slice(markerIndex + marker.length).split('/');
    const versionIndex = pathParts.findIndex(part => /^v\d+$/.test(part));
    if (versionIndex >= 0) pathParts.splice(0, versionIndex + 1);
    else while (pathParts.length && /^[a-z]\_[a-z0-9_,.-]+$/i.test(pathParts[0])) pathParts.shift();
    const publicId = pathParts.join('/').replace(/\.[^/.]+$/, '');
    if (publicId.startsWith(`bartershelf/${ownerId}/`) && !publicId.includes('..')) publicIds.push(publicId);
  }
  await Promise.all(localFiles.map(file => rm(file, { force: true })));
  const credentials = cloudinaryCredentials();
  if (credentials?.local) {
    await rm(path.join(localUploadsDirectory, ownerId), { recursive: true, force: true });
    return;
  }
  if (!credentials) {
    if (publicIds.length) throw new Error('Cloudinary credentials are unavailable for account media deletion.');
    return;
  }
  const cloudinary = await getCloudinaryClient(credentials);
  // Every upload is stored in an account-specific folder, so this also clears
  // photos uploaded before a listing was published.
  const prefixResult = await new Promise((resolve, reject) => cloudinary.api.delete_resources_by_prefix(`bartershelf/${ownerId}/`, { resource_type: 'image', type: 'upload' }, (error, result) => error ? reject(error) : resolve(result)));
  if (prefixResult?.error) throw new Error('Some listing photos could not be removed from image storage.');
  const results = await Promise.all(publicIds.map(id => new Promise((resolve, reject) => cloudinary.uploader.destroy(id, { resource_type: 'image', type: 'upload' }, (error, result) => error ? reject(error) : resolve(result)))));
  if (results.some(result => !['ok', 'not found'].includes(result?.result))) throw new Error('Some listing photos could not be removed from image storage.');
}

async function uploadImage(buffer, userId, credentials, file, req) {
  if (credentials.local) return uploadLocally(file, req, userId);
  const cloudinary = await getCloudinaryClient(credentials);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `bartershelf/${userId}`, resource_type: 'image', transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] }, (error, result) => error ? reject(error) : resolve(result.secure_url));
    stream.end(buffer);
  });
}

async function uploadLocally(file, req, userId) {
  const extensions = { 'image/avif': 'avif', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const extension = extensions[file.mimetype];
  if (!extension) throw new Error('Local photo uploads support JPEG, PNG, GIF, WebP, HEIC, and AVIF images.');

  const filename = `${randomUUID()}.${extension}`;
  const userDirectory = path.join(localUploadsDirectory, userId);
  await mkdir(userDirectory, { recursive: true });
  await writeFile(path.join(userDirectory, filename), file.buffer, { flag: 'wx' });
  return `${req.protocol}://${req.get('host')}/uploads/${userId}/${filename}`;
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
