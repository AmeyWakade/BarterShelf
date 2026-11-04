import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, done) => file.mimetype.startsWith('image/') ? done(null, true) : done(new Error('Only image files are accepted.')),
});
let cloudinaryClient;

function cloudinaryCredentials() {
  const raw = process.env.CLOUDINARY_URL?.trim();
  if (!raw) return null;
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

async function uploadToCloudinary(buffer, userId, credentials) {
  const cloudinary = await getCloudinaryClient(credentials);
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({ folder: `bartershelf/${userId}`, resource_type: 'image', transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto', fetch_format: 'auto' }] }, (error, result) => error ? reject(error) : resolve(result.secure_url));
    stream.end(buffer);
  });
}

router.post('/images', requireAuth, (req, res, next) => {
  const credentials = cloudinaryCredentials();
  if (!credentials) return res.status(503).json({ error: 'Image hosting is unavailable. Set CLOUDINARY_URL to cloudinary://API_KEY:API_SECRET@CLOUD_NAME in the backend environment.' });
  upload.array('images', 4)(req, res, async error => {
    if (error) return next(error);
    try {
      if (!req.files?.length) return res.status(400).json({ error: 'Select at least one image.' });
      const images = await Promise.all(req.files.map(file => uploadToCloudinary(file.buffer, req.user.id, credentials)));
      res.status(201).json({ images });
    } catch (uploadError) { next(uploadError); }
  });
});

export default router;
